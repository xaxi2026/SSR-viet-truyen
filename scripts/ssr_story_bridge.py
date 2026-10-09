#!/usr/bin/env python3
"""SSR Story Bridge v0: read SQLite in read-only mode; stage review-only config proposals.

Usage:
  python scripts/ssr_story_bridge.py inspect --project "D:\...\test-1"
  python scripts/ssr_story_bridge.py propose --project "D:\...\test-1" --input proposal.json

NEVER writes to SQLite, project.json, canonical chapters or author settings.
"""
import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import sys
from datetime import datetime, timezone
from uuid import uuid4

DB_TO_UI = {
    "genre": "genre",
    "sub_genre": "subGenre",
    "target_audience": "targetAudience",
    "total_chapters": "totalChapters",
    "words_per_chapter": "wordsPerChapter",
    "writing_language": "writingLanguage",
    "plot_structure": "plotStructure",
    "narrative_pov": "narrativePOV",
    "core_outline": "coreOutline",
    "world_setting": "worldSetting",
    "golden_finger": "goldenFinger",
    "protagonist_profile": "protagonistProfile",
    "global_guidance": "globalGuidance",
    "writing_style": "writingStyle",
    "reference_works": "referenceWorks",
}
ALLOWED = frozenset(DB_TO_UI.values())
IMMUTABLE = frozenset({"totalChapters", "wordsPerChapter", "writingLanguage", "plotStructure", "narrativePOV"})
# The initial pilot only proposes free-text story content, never scheduling/settings.
PROPOSABLE = ALLOWED - IMMUTABLE - {"genre", "targetAudience"}
MAX_TEXT_CHARS = 14000
MAX_FILE_BYTES = 160000

def project_identity(project: Path):
    project = project.expanduser().resolve(strict=True)
    manifest = project / ".vela" / "project.json"
    db_path = project / ".vela" / "vela.db"
    if not manifest.is_file() or not db_path.is_file():
        raise ValueError("Đường dẫn không phải dự án SSR-viet truyen hợp lệ.")
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if data.get("kind") != "ai-novel-project" or not isinstance(data.get("projectId"), str):
        raise ValueError("Project manifest không hợp lệ.")
    if project.is_symlink() or manifest.is_symlink() or db_path.is_symlink():
        raise ValueError("Không hỗ trợ liên kết tượng trưng của dự án.")
    return project, data["projectId"], db_path

def snapshot(project: Path):
    project, project_id, db_path = project_identity(project)
    # SQLite read-only + WAL snapshot; no writes, migration, backup or schema changes.
    with closing(sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True, timeout=5)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        row = db.execute("SELECT * FROM project_core WHERE id='main'").fetchone()
        if row is None:
            raise ValueError("Dự án chưa có cấu hình chính thức.")
        config = {ui: row[column] for column, ui in DB_TO_UI.items()}
        name = row["project_name"]
        updated = row["updated_at"]
    return {
        "schemaVersion": 1,
        "projectId": project_id,
        "projectName": name,
        "projectPath": str(project),
        "persistedAt": updated,
        "config": config,
    }

def read_json(path: Path):
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("Tệp đầu vào không tồn tại hoặc quá lớn.")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Đề xuất phải là JSON object.")
    return raw

def validate_proposal(proposal, identity):
    if proposal.get("projectId") != identity["projectId"]:
        raise ValueError("Project ID không khớp. Từ chối đề xuất.")
    fields = proposal.get("changes")
    if not isinstance(fields, dict) or not fields or (set(fields) - PROPOSABLE):
        raise ValueError("Chỉ cho phép các trường nội dung truyện trong changes.")
    clean = {}
    for key, value in fields.items():
        if not isinstance(value, str) or len(value.strip()) < 1 or len(value) > MAX_TEXT_CHARS:
            raise ValueError(f"Trường {key} không phải chuỗi hợp lệ (tối đa {MAX_TEXT_CHARS} ký tự).")
        clean[key] = value.strip()
    note = proposal.get("note", "")
    if not isinstance(note, str) or len(note) > 2000:
        raise ValueError("Ghi chú không hợp lệ.")
    return clean, note

def stage(project, source):
    baseline = snapshot(project)
    changes, note = validate_proposal(read_json(source), baseline)
    inbox_dir = Path(baseline["projectPath"]) / ".vela" / "story-bridge"
    if inbox_dir.is_symlink():
        raise ValueError("Thư mục nhận đề xuất không được là symlink.")
    inbox_dir.mkdir(exist_ok=True, mode=0o700)
    pending = inbox_dir / "pending-config.json"
    artifact = {
        "kind": "ssr-config-proposal",
        "schemaVersion": 1,
        "proposalId": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "projectId": baseline["projectId"],
        "projectName": baseline["projectName"],
        "baseline": baseline["config"],
        "changes": changes,
        "note": note,
        "status": "pending",
    }
    raw = json.dumps(artifact, ensure_ascii=False, indent=2)
    if len(raw.encode("utf-8")) > MAX_FILE_BYTES:
        raise ValueError("Đề xuất vượt giới hạn.")
    # Fail closed: no replace of an existing pending proposal.
    with pending.open("x", encoding="utf-8") as file:
        file.write(raw)
        file.flush()
        os.fsync(file.fileno())
    return {"status": "pending_review", "proposalId": artifact["proposalId"], "path": str(pending), "fields": list(changes)}

def main():
    parser = argparse.ArgumentParser(description="SSR Story Bridge — staged, review-only configuration proposals")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "propose"):
        cmd = commands.add_parser(name)
        cmd.add_argument("--project", required=True, type=Path)
        if name == "propose":
            cmd.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    result = snapshot(args.project) if args.command == "inspect" else stage(args.project, args.input)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
