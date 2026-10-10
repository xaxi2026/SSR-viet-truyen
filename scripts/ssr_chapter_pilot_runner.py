#!/usr/bin/env python3
"""Guarded laptop-local pilot: reviewed Story Bridge 1–10 -> SSR blueprints + draft 1.

Use the application's existing BlueprintRepository and DraftRepository, compiled
and executed with Electron's native Node ABI. Do not write story SQLite by hand.
There is no automatic chapter finalization or remote provider invocation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
import unicodedata

from ssr_outline_bridge import inspect


def positive_path(s: str) -> Path:
    result = Path(s).resolve(strict=True)
    if not result.exists():
        raise ValueError("No such path: " + s)
    return result


def db_counts(dbfile: Path) -> dict:
    with sqlite3.connect(dbfile.as_uri() + "?mode=ro", uri=True) as db:
        db.execute("PRAGMA query_only=ON")
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise ValueError("SQLite integrity failed: " + str(integrity))
        stats = {}
        for table in ("blueprints", "drafts", "contents", "finalization_outbox"):
            stats[table] = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        return stats


def run(args: argparse.Namespace) -> None:
    project = positive_path(args.project)
    prose_file = positive_path(args.draft)
    repo = Path(__file__).resolve().parents[1]
    dbfile = project / ".vela" / "vela.db"
    if not dbfile.is_file() or dbfile.is_symlink():
        raise ValueError("Project DB must be a regular existing file")
    if prose_file.suffix.lower() not in (".md", ".txt"):
        raise ValueError("Input chapter draft must be a UTF-8 .md or .txt")
    status = inspect(project)
    if status.get("coveredTo") != 500 or status.get("nextFrom") != 501:
        raise ValueError("Expected 500 chapters already reviewed in Story Bridge")
    if status.get("sourceDrift") or status.get("pending"):
        raise ValueError("Project facts changed or another outline is pending")
    if status.get("projectId") != args.project_id:
        raise ValueError("Story Bridge project ID mismatch")
    draft_text = unicodedata.normalize("NFC", prose_file.read_text(encoding="utf8"))
    space_count = len(draft_text.split())
    if not 2250 <= space_count <= 2750:
        raise ValueError(f"Expected approximately 2,500 Vietnamese words, got {space_count}")
    before = db_counts(dbfile)
    if args.dry_run:
        print(json.dumps({"preflight": "ok", "project": str(project),
                          "fromApproved": [1, 10], "draftChapter": 1,
                          "spaceSeparatedWords": space_count,
                          "dbBefore": before}, ensure_ascii=False))
        return
    safe = (project / ".vela" / "backups" / "prose-pilot")
    safe.mkdir(parents=True, exist_ok=True)
    backup = safe / ("vela-before-draft-1-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".db")
    with sqlite3.connect(dbfile.as_uri() + "?mode=ro", uri=True) as source:
        with sqlite3.connect(backup) as snapshot:
            source.backup(snapshot)
            check = snapshot.execute("PRAGMA integrity_check").fetchone()[0]
            if check != "ok":
                raise ValueError("Backup integrity failed")
    builder = repo / "node_modules" / ".bin" / "esbuild.cmd"
    electron = repo / "node_modules" / "electron" / "dist" / "electron.exe"
    output = repo / "node_modules" / ".cache" / "ssr_approved_chapter_import.mjs"
    output.parent.mkdir(exist_ok=True)
    if os.name != "nt" or not builder.is_file() or not electron.is_file():
        raise RuntimeError("This pilot requires the existing Windows Electron development runtime")
    build = subprocess.run([
        str(builder), "scripts/ssr_approved_chapter_import.ts",
        "--bundle", "--platform=node", "--format=esm", "--target=node22",
        "--external:better-sqlite3",
        "--alias:electron=./scripts/ssr_approved_import_electron_shim.ts",
        f"--outfile={output}",
    ], cwd=repo, capture_output=True, text=True, timeout=120)
    if build.returncode != 0:
        raise RuntimeError("Importer build failed: " + build.stderr[-3000:])
    env = dict(os.environ)
    env["ELECTRON_RUN_AS_NODE"] = "1"
    command = [str(electron), str(output), "--project", str(project),
               "--draft", str(prose_file), "--project-id", args.project_id]
    launched = subprocess.run(command, cwd=repo, env=env, capture_output=True,
                              text=True, encoding="utf8", errors="replace", timeout=120)
    if launched.returncode != 0:
        raise RuntimeError("SSR repository import failed: " + launched.stderr[-3000:] +
                           "\n" + launched.stdout[-1000:])
    with sqlite3.connect(dbfile.as_uri() + "?mode=ro", uri=True) as db:
        db.execute("PRAGMA query_only=ON")
        blueprints = db.execute("SELECT chapter_number,title FROM blueprints WHERE chapter_number BETWEEN 1 AND 10 ORDER BY chapter_number").fetchall()
        drafts = db.execute("""
            SELECT d.id,d.version,d.status,d.word_count,c.body
            FROM drafts AS d INNER JOIN contents AS c ON c.id=d.content_id
            WHERE d.chapter_number=1 ORDER BY d.version
        """).fetchall()
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        count_final = db.execute("SELECT COUNT(*) FROM finalization_outbox WHERE chapter_number=1").fetchone()[0]
        if (len(blueprints) != 10 or [r[0] for r in blueprints] != list(range(1, 11))
           or len(drafts) != 1 or drafts[0][2] != "draft" or count_final != 0
           or integrity != "ok" or unicodedata.normalize("NFC", drafts[0][4]).replace("\r\n", "\n") != draft_text.replace("\r\n", "\n")):
            raise RuntimeError("Post-import verification failed; backup at " + str(backup))
        result = {"status": "verified", "backup": str(backup),
                  "nativeBlueprints": len(blueprints), "draftId": drafts[0][0],
                  "chapter": 1, "draftVersion": drafts[0][1],
                  "draftStatus": drafts[0][2], "ssrWords": drafts[0][3],
                  "bodySha256": hashlib.sha256(drafts[0][4].encode("utf8")).hexdigest(),
                  "finalized": False, "integrity": integrity, "dbBefore": before}
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--draft", required=True)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    try:
        run(parser.parse_args())
    except Exception as error:
        print(json.dumps({"status": "BLOCKED", "reason": str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
