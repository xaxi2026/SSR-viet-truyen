"""No real project data is written by these tests."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from uuid import uuid4

import ssr_outline_bridge as bridge

SUMMARY = (
    "Lục Hoài An lần theo vết mực trên linh bài trong miếu. "
    "Một lời khai trái ngược khiến anh phải so sánh cả vật chứng với ký ức còn sót lại."
)

class OutlineBridgeTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.project = Path(temp.name) / "test-1"
        self.vela = self.project / ".vela"
        self.vela.mkdir(parents=True)
        self.id = "integration-project"
        (self.vela / "project.json").write_text(json.dumps({
            "kind": "ai-novel-project", "projectId": self.id
        }), encoding="utf8")
        self.db = self.vela / "vela.db"
        with closing(sqlite3.connect(self.db)) as conn:
            conn.execute("CREATE TABLE project_core (id TEXT, project_name TEXT, premise TEXT,"
                         " worldbuilding TEXT, core_outline TEXT, global_guidance TEXT,"
                         " total_chapters INTEGER, words_per_chapter INTEGER, writing_language TEXT)")
            conn.execute("INSERT INTO project_core VALUES (?,?,?,?,?,?,?,?,?)", (
                "main", "test-1", "Đã duyệt tiền đề", "Đã duyệt Cửu Châu",
                "Sổ Không Tên", "Chỉ đưa bằng chứng sau điều tra", 500, 2500, "vi-VN",
            ))
            conn.execute("CREATE TABLE character_roster_meta (id TEXT, revision INTEGER, fact_hash TEXT)")
            conn.execute("INSERT INTO character_roster_meta VALUES ('main',2,'facts-v2')")
            conn.commit()
    def proposal(self, from_=1, to=10):
        return {
            "projectId": self.id, "from": from_, "to": to,
            "chapters": [{
                "chapter": i, "title": f"Vết mực {i}",
                "summary": SUMMARY, "conflict": "Lời khai trái ngược",
                "hook": "Một trang sổ rách", "continuity": "Chưa biết số phận Tiểu Nghi",
            } for i in range(from_, to + 1)],
        }
    def input(self, content):
        file = self.project / "input.json"
        file.write_text(json.dumps(content, ensure_ascii=False), encoding="utf8")
        return file

    def test_inspect_stage_preserves_database_and_requires_review(self):
        before = self.db.read_bytes()
        status = bridge.inspect(self.project)
        self.assertEqual(status["nextFrom"], 1)
        self.assertEqual(status["baseline"]["rosterFactHash"], "facts-v2")
        receipt = bridge.propose(self.project, self.input(self.proposal()))
        self.assertEqual(receipt["to"], 10)
        self.assertEqual(self.db.read_bytes(), before)
        staged = bridge.read_json(Path(receipt["path"]))
        self.assertEqual(staged["previousAcceptedId"], None)
        self.assertEqual(len(staged["chapters"]), 10)
        with self.assertRaises(FileExistsError):
            bridge.propose(self.project, self.input(self.proposal()))

    def test_rejects_skips_and_invalid_chapters(self):
        for bad in (
            self.proposal(2, 11),
            self.proposal(1, 11),
            {"projectId": "wrong", **{k:v for k,v in self.proposal().items() if k != "projectId"}},
            {**self.proposal(), "chapters": self.proposal()["chapters"][:-1]},
            {**self.proposal(), "chapters": [
                {**x, "summary": "too short"} if x["chapter"] == 5 else x
                for x in self.proposal()["chapters"]]},
        ):
            with self.assertRaises(ValueError):
                bridge.propose(self.project, self.input(bad))

    def test_blocks_unapproved_world(self):
        with closing(sqlite3.connect(self.db)) as conn:
            conn.execute("UPDATE project_core SET worldbuilding=''")
            conn.commit()
        with self.assertRaisesRegex(ValueError, "Tiền đề"):
            bridge.propose(self.project, self.input(self.proposal()))

    def test_accepted_history_requires_contiguous_prefix(self):
        status = bridge.inspect(self.project)
        archive_dir = self.vela / "story-bridge" / "history" / "outline"
        archive_dir.mkdir(parents=True)
        previous = str(uuid4())
        staged = {
            "kind": "ssr-outline-batch-proposal", "schemaVersion": 1,
            "proposalId": previous, "projectId": self.id, "previousAcceptedId": None,
            "from": 1, "to": 10, "chapters": self.proposal()["chapters"],
            "baseline": status["baseline"],
        }
        (archive_dir / f"{previous}.json").write_text(json.dumps({
            "proposal": staged,
            "resolution": {"status": "accepted", "resolvedAt": "2026-10-11T00:00:00Z"},
        }), encoding="utf8")
        next_state = bridge.inspect(self.project)
        self.assertEqual(next_state["nextFrom"], 11)
        self.assertEqual(next_state["previousAcceptedId"], previous)
        receipt = bridge.propose(self.project, self.input(self.proposal(11, 20)))
        self.assertEqual(bridge.read_json(Path(receipt["path"]))["previousAcceptedId"], previous)

    def test_read_approved_and_source_drift_block_next_batch(self):
        archive_dir = self.vela / "story-bridge" / "history" / "outline"
        archive_dir.mkdir(parents=True)
        approved_id = str(uuid4())
        history_record = {
            "proposal": {
                **self.proposal(), "proposalId": approved_id,
                "previousAcceptedId": None,
                "baseline": bridge.snapshot(self.project)["baseline"],
            },
            "resolution": {"status": "accepted", "resolvedAt": "2026-10-11T00:00:00Z"},
        }
        (archive_dir / f"{approved_id}.json").write_text(json.dumps(history_record),
                                                         encoding="utf8")
        self.assertEqual(bridge.read_approved(self.project, 3)["chapters"][0]["chapter"], 8)
        self.assertEqual(bridge.read_approved(self.project, 3)["coveredTo"], 10)
        with closing(sqlite3.connect(self.db)) as conn:
            conn.execute("UPDATE project_core SET core_outline='Đã đổi canon'")
            conn.commit()
        self.assertTrue(bridge.inspect(self.project)["sourceDrift"])
        with self.assertRaisesRegex(ValueError, "đã đổi"):
            bridge.propose(self.project, self.input(self.proposal(11, 20)))

    def test_volume_supersedes_identical_pending_prefix_with_receipt(self):
        old_input = self.input(self.proposal())
        prior = bridge.propose(self.project, old_input)
        initial = bridge.read_json(Path(prior["path"]))
        volume = self.proposal(1, 100)
        source = self.input(volume)
        self.assertEqual(bridge.read_json(Path(prior["path"]))["to"], 10)
        staged = bridge.propose(self.project, source, volume=True, supersede=True)
        self.assertEqual(staged["to"], 100)
        receipt_path = self.vela / "story-bridge" / "history" / "outline" / (prior["proposalId"] + ".json")
        receipt = bridge.read_json(receipt_path)
        self.assertEqual(receipt["proposal"], initial)
        self.assertEqual(receipt["resolution"]["status"], "revision_requested")
        self.assertEqual(bridge.read_json(Path(staged["path"]))["kind"], "ssr-outline-volume-proposal")
        self.assertEqual(bridge.read_json(Path(staged["path"]))["chapters"][:10], initial["chapters"])
        self.assertEqual(bridge.inspect(self.project)["coveredTo"], 0)
        self.assertEqual(bridge.inspect(self.project)["pending"], True)

    def test_volume_blocks_changed_pending_prefix(self):
        prior = bridge.propose(self.project, self.input(self.proposal()))
        bad_volume = self.proposal(1, 100)
        bad_volume["chapters"][0]["title"] = "Rewritten without approval"
        with self.assertRaisesRegex(ValueError, "khác"):
            bridge.propose(self.project, self.input(bad_volume), volume=True, supersede=True)
        self.assertEqual(bridge.read_json(Path(prior["path"]))["to"], 10)
        self.assertFalse((self.vela / "story-bridge" / "history" / "outline").exists())

    def test_single_100_chapter_volume_can_stage_when_no_pending(self):
        result = bridge.propose(self.project, self.input(self.proposal(1, 100)), volume=True)
        self.assertEqual(result["from"], 1)
        self.assertEqual(result["to"], 100)
        self.assertFalse(self.db.is_symlink())
        self.assertEqual(bridge.read_json(Path(result["path"]))["kind"], "ssr-outline-volume-proposal")

    def test_volume_can_fallback_when_windows_refuses_replace_existing(self):
        from unittest.mock import patch
        import os
        prior = bridge.propose(self.project, self.input(self.proposal()))
        pending = Path(prior["path"])
        original_replace = os.replace
        errors = []
        def blocked_if_destination_exists(src, target):
            if Path(target) == pending and pending.exists():
                errors.append("windows existing target")
                raise PermissionError("Windows won't replace existing file")
            return original_replace(src, target)
        with patch.object(bridge.os, "replace", side_effect=blocked_if_destination_exists):
            staged = bridge.propose(self.project, self.input(self.proposal(1, 100)),
                                    volume=True, supersede=True)
        self.assertEqual(staged["to"], 100)
        self.assertEqual(len(errors), 1)
        self.assertTrue((pending.parent / ("superseded-" + prior["proposalId"] + ".json")).exists())
        self.assertEqual(bridge.read_json(pending)["to"], 100)

if __name__ == "__main__":
    unittest.main()
