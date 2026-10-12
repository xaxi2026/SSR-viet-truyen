#!/usr/bin/env python3
"""Checkpointed ChatGPT scene staging. Does not call models, finalize, or modify SQLite.

This is a safe bridge for interactive ChatGPT sessions; saved files remain CANDIDATES
until the application's native DraftRepository importer is used and the author approves.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path

BATCH_ROOT = Path(".vela") / "story-bridge" / "batches"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".ssr-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def valid_project(root: Path) -> str:
    data = json.loads((root / ".vela" / "project.json").read_text(encoding="utf-8"))
    pid = data.get("projectId")
    if not isinstance(pid, str) or not pid:
        raise ValueError("Invalid project ID")
    return pid


def check_preflight(root: Path, start: int, count: int):
    if start < 1 or count < 1 or count > 10 or start + count > 10001:
        raise ValueError("Start/count outside safe batch boundaries")
    uri = (root / ".vela" / "vela.db").resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as db:
        blueprints = {int(r[0]) for r in db.execute(
            "select chapter_number from blueprints where chapter_number between ? and ?",
            (start, start + count - 1),
        )}
        existing = db.execute(
            "select chapter_number,status from drafts where chapter_number between ? and ?",
            (start, start + count - 1),
        ).fetchall()
        previous = db.execute(
            "select 1 from drafts where chapter_number = ? and status='finalized' limit 1",
            (start - 1,),
        ).fetchone() if start > 1 else True
    expected = set(range(start, start + count))
    if blueprints != expected:
        raise ValueError(f"Missing approved imported blueprints: {sorted(expected - blueprints)}")
    if existing:
        raise ValueError(f"Existing chapter drafts; never overwrite: {existing}")
    if not previous:
        raise ValueError(f"Previous chapter {start - 1} is not finalized")


def batch_path(root: Path, name: str) -> Path:
    if not name or len(name) > 80 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for c in name):
        raise ValueError("Use a simple batch ID [A-Za-z0-9_-] only")
    return root / BATCH_ROOT / name


def read_state(folder: Path) -> dict:
    return json.loads((folder / "state.json").read_text(encoding="utf-8"))


def write_state(folder: Path, state: dict):
    atomic_write(folder / "state.json", (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def create(root: Path, name: str, start: int, count: int, dry_run: bool):
    pid = valid_project(root)
    check_preflight(root, start, count)
    folder = batch_path(root, name)
    if folder.exists():
        raise FileExistsError("Batch already exists")
    if dry_run:
        return {"ready": True, "dryRun": True, "chapters": list(range(start, start + count))}
    state = {
        "schema": "ssr-chatgpt-batch-v1", "projectId": pid,
        "chapters": list(range(start, start + count)), "activeChapter": start,
        "scenes": {}, "submitted": {}, "status": "staging_only",
    }
    folder.mkdir(parents=True, exist_ok=False)
    write_state(folder, state)
    return {"batch": name, "ready": True, "status": state["status"]}


def append(root: Path, name: str, chapter: int, index: int, text_file: Path, key: str):
    folder = batch_path(root, name)
    state = read_state(folder)
    if state["projectId"] != valid_project(root):
        raise ValueError("Wrong project identity")
    if chapter not in state["chapters"] or chapter != state["activeChapter"] or str(chapter) in state["submitted"]:
        raise ValueError("Out-of-sequence chapter")
    if not isinstance(key, str) or not (1 <= len(key) <= 120):
        raise ValueError("Idempotency key required")
    if index < 1 or index > 30:
        raise ValueError("Scene index out of range")
    source = text_file.read_bytes()
    if not source or len(source) > 40_000:
        raise ValueError("Scene must be nonempty and <= 40KB")
    source.decode("utf-8", errors="strict")
    h = digest(source)
    scenes = state["scenes"].setdefault(str(chapter), [])
    for previous in scenes:
        if previous["key"] == key or previous["index"] == index:
            if previous["key"] == key and previous["index"] == index and previous["sha256"] == h:
                return {"chapter": chapter, "scene": index, "idempotent": True, "sha256": h}
            raise ValueError("Scene idempotency conflict")
    if index != len(scenes) + 1:
        raise ValueError("Must append the next scene in sequence")
    output = folder / f"chapter-{chapter:04}-scene-{index:02}.txt"
    if output.exists():
        raise ValueError("Orphan scene checkpoint detected; recovery required before any overwrite")
    atomic_write(output, source)
    scenes.append({"index": index, "key": key, "sha256": h, "file": output.name})
    write_state(folder, state)
    return {"chapter": chapter, "scene": index, "idempotent": False, "sha256": h}


def submit(root: Path, name: str, chapter: int):
    folder = batch_path(root, name)
    state = read_state(folder)
    if state["projectId"] != valid_project(root) or chapter != state["activeChapter"]:
        raise ValueError("Wrong project or chapter")
    scenes = state["scenes"].get(str(chapter), [])
    if not scenes:
        raise ValueError("No scenes for chapter")
    content = []
    for scene in scenes:
        data = (folder / scene["file"]).read_bytes()
        if digest(data) != scene["sha256"]:
            raise ValueError("Scene changed after approval of checkpoint")
        content.append(data.decode("utf-8"))
    full = "\n\n".join(content).encode("utf-8")
    path = folder / f"chapter-{chapter:04}-candidate.txt"
    if path.exists() and path.read_bytes() != full:
        raise ValueError("Candidate collision")
    if not path.exists():
        atomic_write(path, full)
    state["submitted"][str(chapter)] = digest(full)
    remaining = [number for number in state["chapters"] if str(number) not in state["submitted"]]
    state["activeChapter"] = remaining[0] if remaining else None
    state["status"] = "awaiting_native_import" if not remaining else "staging_only"
    write_state(folder, state)
    return {"candidate": str(path), "sha256": digest(full), "wordsApprox": len(full.decode("utf-8").split()),
            "note": "NOT an app draft or finalized chapter"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    st = sub.add_parser("start")
    st.add_argument("--batch", required=True)
    st.add_argument("--start", type=int, required=True)
    st.add_argument("--count", type=int, required=True)
    st.add_argument("--dry-run", action="store_true")
    a = sub.add_parser("append")
    a.add_argument("--batch", required=True)
    a.add_argument("--chapter", type=int, required=True)
    a.add_argument("--index", type=int, required=True)
    a.add_argument("--text-file", type=Path, required=True)
    a.add_argument("--key", required=True)
    s = sub.add_parser("submit")
    s.add_argument("--batch", required=True)
    s.add_argument("--chapter", type=int, required=True)
    st = sub.add_parser("status")
    st.add_argument("--batch", required=True)
    args = parser.parse_args()
    project = args.project.resolve()
    result = create(project, args.batch, args.start, args.count, args.dry_run) if args.command == "start" else (
        append(project, args.batch, args.chapter, args.index, args.text_file, args.key) if args.command == "append" else (
            submit(project, args.batch, args.chapter) if args.command == "submit" else
            read_state(batch_path(project, args.batch))))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
