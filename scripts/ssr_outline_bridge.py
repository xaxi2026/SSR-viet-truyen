#!/usr/bin/env python3
"""Read-only inspection and safe staging of ChatGPT outline batches for SSR-viet truyen.

Independent from the application's built-in synopsis generator/checkpoint.
Accept/reject/history are controlled only by SSR main-process review UI.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
from uuid import uuid4

from ssr_story_bridge import project_identity

MAX_BYTES = 600000
MAX_BATCH = 10
MAX_VOLUME = 100
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
CHAPTER_FIELDS = {"chapter", "title", "summary", "conflict", "hook", "continuity"}
BASELINE_FIELDS = ("premise", "worldbuilding", "coreOutline", "globalGuidance",
                   "totalChapters", "wordsPerChapter", "writingLanguage",
                   "rosterRevision", "rosterFactHash")


def read_json(file: Path) -> dict:
    if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_BYTES:
        raise ValueError("Tệp đề xuất hoặc lịch sử không hợp lệ.")
    payload = json.loads(file.read_text(encoding="utf8"))
    if not isinstance(payload, dict):
        raise ValueError("JSON phải là đối tượng.")
    return payload


def safe_dir(base: Path, create=False) -> Path:
    root = base.resolve(strict=True)
    for segment in (".vela", "story-bridge", "history", "outline"):
        root = root / segment
        if create and not root.exists():
            root.mkdir()
        if root.exists() and (root.is_symlink() or not root.is_dir()):
            raise ValueError("Đường dẫn lưu trữ không an toàn.")
    return root


def snapshot(project: Path) -> dict:
    root, project_id, db_path = project_identity(project)
    with closing(sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True, timeout=8)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        row = db.execute(
            "SELECT project_name, premise, worldbuilding, core_outline, global_guidance, "
            "total_chapters, words_per_chapter, writing_language FROM project_core WHERE id='main'"
        ).fetchone()
        roster = db.execute(
            "SELECT revision, fact_hash FROM character_roster_meta WHERE id='main'"
        ).fetchone()
        if row is None or roster is None:
            raise ValueError("Dự án chưa có cấu hình hoặc roster.")
        baseline = {
            "premise": row["premise"] or "",
            "worldbuilding": row["worldbuilding"] or "",
            "coreOutline": row["core_outline"] or "",
            "globalGuidance": row["global_guidance"] or "",
            "totalChapters": row["total_chapters"],
            "wordsPerChapter": row["words_per_chapter"],
            "writingLanguage": row["writing_language"],
            "rosterRevision": roster["revision"],
            "rosterFactHash": roster["fact_hash"] or "",
        }
    return {"projectId": project_id, "projectName": row["project_name"],
            "projectPath": str(root), "baseline": baseline}


def accepted_history(root: Path, project_id: str) -> tuple[int, str | None, list[dict]]:
    folder = safe_dir(root)
    if not folder.exists():
        return 0, None, []
    archive = []
    for file in folder.glob("*.json"):
        if not UUID.fullmatch(file.stem):
            continue
        receipt = read_json(file)
        proposal = receipt.get("proposal")
        resolution = receipt.get("resolution")
        if not isinstance(proposal, dict) or not isinstance(resolution, dict):
            raise ValueError("Lịch sử có biên nhận bị hỏng.")
        if proposal.get("projectId") != project_id or proposal.get("proposalId") != file.stem:
            raise ValueError("Lịch sử dàn ý của dự án khác hoặc sai danh tính.")
        if resolution.get("status") not in ("accepted", "rejected", "revision_requested"):
            raise ValueError("Biên nhận dàn ý không có trạng thái hợp lệ.")
        archive.append({"proposalId": proposal["proposalId"], "from": proposal.get("from"),
                        "to": proposal.get("to"), "status": resolution["status"],
                        "feedback": resolution.get("feedback", "")})
    accepted = sorted((x for x in archive if x["status"] == "accepted"), key=lambda x: x["from"])
    covered, predecessor = 0, None
    for receipt in accepted:
        if receipt["from"] != covered + 1 or not isinstance(receipt["to"], int) or receipt["to"] < receipt["from"]:
            raise ValueError("Lịch sử có khoảng trống hoặc chồng lấn, không thể nối dàn ý.")
        # Previous link is validated in Electron; check again here for inconsistent archive receipts.
        raw = read_json(folder / (receipt["proposalId"] + ".json"))["proposal"]
        if raw.get("previousAcceptedId") != predecessor:
            raise ValueError("Chuỗi đề xuất đã được duyệt không khớp.")
        covered, predecessor = receipt["to"], receipt["proposalId"]
    return covered, predecessor, archive


def inspect(project: Path) -> dict:
    state = snapshot(project)
    covered, prev, history = accepted_history(Path(state["projectPath"]), state["projectId"])
    inbox = Path(state["projectPath"]) / ".vela" / "story-bridge" / "pending-outline-batch.json"
    folder = Path(state["projectPath"]) / ".vela" / "story-bridge" / "history" / "outline"
    source_drift = False
    for accepted in (x for x in history if x["status"] == "accepted"):
        proposal = read_json(folder / (accepted["proposalId"] + ".json"))["proposal"]
        if (not isinstance(proposal.get("baseline"), dict)
                or any(proposal["baseline"].get(field) != state["baseline"][field]
                       for field in BASELINE_FIELDS)):
            source_drift = True
    return {**state, "coveredTo": covered, "nextFrom": covered + 1,
            "previousAcceptedId": prev,
            "sourceDrift": source_drift,
            "pending": inbox.exists(), "history": history}


def validate_chapters(chapters, start, end):
    if not isinstance(chapters, list) or len(chapters) != end - start + 1:
        raise ValueError("Mỗi chương trong khoảng phải có một hồ sơ.")
    for index, chapter in enumerate(chapters):
        if not isinstance(chapter, dict) or set(chapter) != CHAPTER_FIELDS:
            raise ValueError("Hồ sơ chương thiếu hoặc dư trường.")
        if type(chapter["chapter"]) is not int or chapter["chapter"] != start + index:
            raise ValueError("Thứ tự chương không liên tục hoặc sai số.")
        for field, size, needed in (
            ("title", 180, 1), ("summary", 6000, 60),
            ("conflict", 1500, 1), ("hook", 1500, 1), ("continuity", 2500, 0),
        ):
            value = chapter[field]
            if not isinstance(value, str) or len(value) > size or len(value.strip()) < needed:
                raise ValueError(f"Chương {chapter['chapter']}: {field} thiếu hoặc quá dài.")


def archive_superseded_and_stage(base: Path, state: dict, pending: Path,
                                 proposal: dict, serialized: str):
    # Never discard an author-visible pending proposal. Archive it as revised
    # only when its chapter beats are an exact prefix of the proposed volume.
    if not pending.exists():
        raise FileNotFoundError("Không còn đề xuất cũ để thay thế.")
    old_bytes = pending.read_bytes()
    old = read_json(pending)
    if (old.get("kind") != "ssr-outline-batch-proposal"
            or old.get("status") != "pending"
            or old.get("projectId") != state["projectId"]
            or not UUID.fullmatch(str(old.get("proposalId", "")))
            or old.get("baseline") != state["baseline"]
            or old.get("from") != proposal["from"]
            or old.get("previousAcceptedId") != proposal["previousAcceptedId"]
            or not isinstance(old.get("chapters"), list)
            or not old["chapters"]
            or old["chapters"] != proposal["chapters"][:len(old["chapters"])]):
        raise ValueError("Đề xuất cũ khác nội dung đầu quyển, không được thay thế tự động.")
    history = safe_dir(base, create=True)
    receipt_path = history / (old["proposalId"] + ".json")
    receipt = {
        "proposal": old,
        "resolution": {
            "status": "revision_requested",
            "feedback": "Tác giả yêu cầu gộp phần còn lại của quyển thành một lần duyệt (100 chương).",
            "resolvedAt": datetime.now(timezone.utc).isoformat(),
        }
    }
    if receipt_path.exists():
        previous = read_json(receipt_path)
        if (previous.get("proposal") != old
                or previous.get("resolution", {}).get("status") != "revision_requested"):
            raise ValueError("Đề xuất cũ đã được xử lý bởi yêu cầu khác.")
    tmp = pending.with_name("." + proposal["proposalId"] + ".outline.tmp")
    try:
        with tmp.open("x", encoding="utf8") as file:
            file.write(serialized)
            file.flush()
            os.fsync(file.fileno())
        if not receipt_path.exists():
            with receipt_path.open("x", encoding="utf8") as file:
                json.dump(receipt, file, ensure_ascii=False, indent=2)
                file.flush()
                os.fsync(file.fileno())
        if pending.read_bytes() != old_bytes:
            raise ValueError("Đề xuất đã bị thay đổi đồng thời; không ghi đè.")
        try:
            os.replace(tmp, pending)
        except PermissionError:
            # On Windows, replacing an existing JSON file can be denied even
            # when same-directory rename works. Move the old version to a
            # named backup, then put the already fsynced new version in place.
            # On any failure roll the original back.
            backup = pending.with_name("superseded-" + old["proposalId"] + ".json")
            if backup.exists():
                raise FileExistsError("Đã tồn tại bản lưu an toàn đề xuất cũ.")
            os.rename(pending, backup)
            try:
                os.replace(tmp, pending)
            except BaseException:
                if not pending.exists():
                    os.rename(backup, pending)
                raise
    finally:
        if tmp.exists():
            tmp.unlink()


def propose(project: Path, input_file: Path, volume=False, supersede=False):
    state = inspect(project)
    if state["sourceDrift"]:
        raise ValueError("Nguồn dữ kiện đã đổi sau khi duyệt dàn ý; không được nối đợt mới.")
    if not state["baseline"]["premise"].strip() or not state["baseline"]["worldbuilding"].strip():
        raise ValueError("Cần duyệt Tiền đề và Xây dựng thế giới trước khi lập dàn ý.")
    if state["pending"] and not supersede:
        raise FileExistsError("Đang có đề xuất dàn ý chờ duyệt.")
    if supersede and not volume:
        raise ValueError("Chỉ có thể thay thế đề xuất cũ bằng cả quyển.")
    raw = read_json(input_file)
    if raw.get("projectId") != state["projectId"]:
        raise ValueError("Không đúng projectId.")
    start, end = raw.get("from"), raw.get("to")
    if (type(start) is not int or type(end) is not int
        or start != state["nextFrom"] or end < start
        or end - start >= (MAX_VOLUME if volume else MAX_BATCH)
        or end > state["baseline"]["totalChapters"]
        or (volume and end != min(((start - 1) // MAX_VOLUME + 1) * MAX_VOLUME,
                                 state["baseline"]["totalChapters"]))):
        raise ValueError("Đợt phải liên tục; cả quyển kết thúc tại mốc 100 chương.")
    validate_chapters(raw.get("chapters"), start, end)
    note = raw.get("note", "")
    if not isinstance(note, str) or len(note) > 2000:
        raise ValueError("Ghi chú không hợp lệ.")
    base = Path(state["projectPath"])
    folder = base / ".vela" / "story-bridge"
    if folder.is_symlink():
        raise ValueError("Thư mục cầu nối là symlink.")
    folder.mkdir(exist_ok=True)
    pending = folder / "pending-outline-batch.json"
    artifact = {
        "kind": "ssr-outline-volume-proposal" if volume else "ssr-outline-batch-proposal", "schemaVersion": 1, "status": "pending",
        "proposalId": str(uuid4()), "createdAt": datetime.now(timezone.utc).isoformat(),
        "projectId": state["projectId"], "projectName": state["projectName"],
        "note": note, "from": start, "to": end,
        "previousAcceptedId": state["previousAcceptedId"], "baseline": state["baseline"],
        "chapters": raw["chapters"],
    }
    serialized = json.dumps(artifact, ensure_ascii=False, indent=2)
    if len(serialized.encode("utf8")) > MAX_BYTES:
        raise ValueError("Đề xuất quá lớn.")
    if supersede:
        archive_superseded_and_stage(base, state, pending, artifact, serialized)
    else:
        with pending.open("x", encoding="utf8") as file:
            file.write(serialized)
            file.flush()
            os.fsync(file.fileno())
    return {"status": "pending_review", "path": str(pending),
            "proposalId": artifact["proposalId"], "from": start, "to": end}


def read_approved(project: Path, last: int = 10):
    if not isinstance(last, int) or not (1 <= last <= 100):
        raise ValueError("last phải trong khoảng 1–100.")
    state = inspect(project)
    root = Path(state["projectPath"])
    archive_dir = root / ".vela" / "story-bridge" / "history" / "outline"
    all_chapters = []
    accepted = sorted(
        (h for h in state["history"] if h["status"] == "accepted"),
        key=lambda h: h["from"],
    )
    for entry in accepted:
        receipt = read_json(archive_dir / (entry["proposalId"] + ".json"))
        draft = receipt["proposal"]
        validate_chapters(draft["chapters"], entry["from"], entry["to"])
        all_chapters.extend(draft["chapters"])
    if all_chapters and all_chapters[-1]["chapter"] != state["coveredTo"]:
        raise ValueError("Lịch sử dàn ý đã được duyệt không đồng nhất.")
    return {
        "projectId": state["projectId"],
        "totalChapters": state["baseline"]["totalChapters"],
        "coveredTo": state["coveredTo"],
        "acceptedBatches": len(accepted),
        "previousAcceptedId": state["previousAcceptedId"],
        "chapters": all_chapters[-last:],
    }


def main():
    parser = argparse.ArgumentParser(description="SSR Story Bridge - ChatGPT outline batches")
    cmd = parser.add_subparsers(dest="command", required=True)
    for verb in ("inspect", "propose", "propose-volume", "read-approved"):
        sub = cmd.add_parser(verb)
        sub.add_argument("--project", required=True, type=Path)
        if verb in ("propose", "propose-volume"):
            sub.add_argument("--input", required=True, type=Path)
            if verb == "propose-volume":
                sub.add_argument("--supersede-pending", action="store_true")
        elif verb == "read-approved":
            sub.add_argument("--last", type=int, default=10)
    args = parser.parse_args()
    if args.command == "inspect":
        result = inspect(args.project)
    elif args.command == "read-approved":
        result = read_approved(args.project, args.last)
    else:
        result = propose(args.project, args.input,
                         volume=args.command == "propose-volume",
                         supersede=getattr(args, "supersede_pending", False))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
