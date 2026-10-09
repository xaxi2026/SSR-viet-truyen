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

def history(project):
    baseline = snapshot(project)
    directory = Path(baseline["projectPath"]) / ".vela" / "story-bridge" / "history"
    if not directory.exists():
        return {"projectId": baseline["projectId"], "history": []}
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("Thư mục lịch sử không hợp lệ.")
    entries = []
    for item in list(directory.glob("*.json"))[:100]:
        if item.is_symlink() or item.stat().st_size > MAX_FILE_BYTES:
            raise ValueError("Tệp lịch sử không hợp lệ.")
        record = read_json(item)
        proposal = record.get("proposal", {})
        resolution = record.get("resolution", {})
        if not isinstance(proposal, dict) or not isinstance(resolution, dict):
            continue
        if proposal.get("projectId") != baseline["projectId"]:
            continue
        if proposal.get("proposalId", "") + ".json" != item.name:
            continue
        if resolution.get("status") not in ("accepted", "rejected", "revision_requested"):
            continue
        entries.append({
            "proposalId": proposal["proposalId"],
            "status": resolution["status"],
            "resolvedAt": resolution.get("resolvedAt", ""),
            "feedback": resolution.get("feedback", ""),
            "fields": list(proposal.get("changes", {})),
        })
    entries.sort(key=lambda item: item["resolvedAt"], reverse=True)
    return {"projectId": baseline["projectId"], "history": entries[:30]}

CHARACTER_FIELDS = (
    "name", "role", "gender", "age", "appearance", "personality",
    "background", "abilities", "motivation", "relationships", "arc", "notes",
)
CHARACTER_ROLES = frozenset(("protagonist", "supporting", "antagonist", "minor"))


def inspect_characters(project):
    identity = snapshot(project)
    db_path = Path(identity["projectPath"]) / ".vela" / "vela.db"
    with closing(sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True, timeout=5)) as db:
        db.execute("PRAGMA query_only=ON")
        revision = db.execute("SELECT revision FROM character_roster_meta LIMIT 1").fetchone()
        existing = [row[0] for row in db.execute("SELECT name FROM characters ORDER BY name")]
    if revision is None or not isinstance(revision[0], int):
        raise ValueError("Danh sách nhân vật chưa được khởi tạo.")
    return {
        "projectId": identity["projectId"],
        "projectName": identity["projectName"],
        "rosterRevision": revision[0],
        "existingNames": existing,
    }


def stage_characters(project, source):
    state = inspect_characters(project)
    proposal = read_json(source)
    if proposal.get("projectId") != state["projectId"]:
        raise ValueError("Đề xuất nhân vật thuộc dự án khác.")
    cards = proposal.get("characters")
    if not isinstance(cards, list) or not (1 <= len(cards) <= 12):
        raise ValueError("Cần từ 1 đến 12 hồ sơ nhân vật.")
    seen = {name.strip().casefold() for name in state["existingNames"]}
    approved = []
    for card in cards:
        if not isinstance(card, dict) or set(card) != set(CHARACTER_FIELDS):
            raise ValueError("Hồ sơ nhân vật thiếu hoặc dư trường.")
        if not isinstance(card["role"], str) or card["role"] not in CHARACTER_ROLES:
            raise ValueError("Vai trò nhân vật không hợp lệ.")
        if any(not isinstance(card[key], str) or len(card[key]) > 8000
               for key in CHARACTER_FIELDS if key != "role"):
            raise ValueError("Thông tin nhân vật phải là văn bản hợp lệ.")
        name = card["name"]
        if not name.strip() or len(name) > 100 or name != name.strip():
            raise ValueError("Tên nhân vật không hợp lệ.")
        if card["relationships"] != "":
            raise ValueError("Bản thử đầu chưa nhận quan hệ; dùng ghi chú hoặc hồ sơ riêng.")
        unique = name.casefold()
        if unique in seen:
            raise ValueError("Nhân vật bị trùng tên với nhau hoặc với dữ liệu đã lưu.")
        seen.add(unique)
        approved.append(card)
    note = proposal.get("note", "")
    if not isinstance(note, str) or len(note) > 2000:
        raise ValueError("Ghi chú không hợp lệ.")
    directory = Path(snapshot(project)["projectPath"]) / ".vela" / "story-bridge"
    if directory.is_symlink():
        raise ValueError("Không hỗ trợ thư mục cầu nối là symlink.")
    directory.mkdir(mode=0o700, exist_ok=True)
    pending = directory / "pending-characters.json"
    receipt = {
        "kind": "ssr-characters-proposal",
        "schemaVersion": 1,
        "proposalId": str(uuid4()),
        "projectId": state["projectId"],
        "projectName": state["projectName"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "rosterRevision": state["rosterRevision"],
        "note": note,
        "characters": approved,
    }
    raw = json.dumps(receipt, ensure_ascii=False, indent=2)
    if len(raw.encode("utf-8")) > MAX_FILE_BYTES:
        raise ValueError("Đề xuất nhân vật vượt kích thước cho phép.")
    with pending.open("x", encoding="utf-8") as f:
        f.write(raw)
        f.flush()
        os.fsync(f.fileno())
    return {"status": "pending_review", "proposalId": receipt["proposalId"],
            "characters": [card["name"] for card in approved], "path": str(pending)}


def main():
    parser = argparse.ArgumentParser(description="SSR Story Bridge — staged, review-only configuration proposals")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "propose", "history", "inspect-characters", "propose-characters"):
        cmd = commands.add_parser(name)
        cmd.add_argument("--project", required=True, type=Path)
        if name in ("propose", "propose-characters"):
            cmd.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    if args.command == "inspect":
        result = snapshot(args.project)
    elif args.command == "history":
        result = history(args.project)
    elif args.command == "inspect-characters":
        result = inspect_characters(args.project)
    elif args.command == "propose-characters":
        result = stage_characters(args.project, args.input)
    else:
        result = stage(args.project, args.input)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
