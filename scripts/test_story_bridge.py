"""SSR Story Bridge v0: no modification to real project database."""
import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

SCRIPT = Path(__file__).parent / "ssr_story_bridge.py"
spec = importlib.util.spec_from_file_location("ssr_story_bridge", SCRIPT)
bridge = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(bridge)

class StoryBridgeTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.project = Path(self.dir.name) / "test-bridge"
        hidden = self.project / ".vela"
        hidden.mkdir(parents=True)
        self.project_id = "integration-project-id"
        (hidden / "project.json").write_text(json.dumps({
            "kind": "ai-novel-project", "projectId": self.project_id
        }), encoding="utf8")
        self.dbfile = hidden / "vela.db"
        with closing(sqlite3.connect(self.dbfile)) as db:
            defs = ", ".join(f"{c} TEXT" for c in bridge.DB_TO_UI
                if c not in ("total_chapters", "words_per_chapter"))
            db.execute(f"CREATE TABLE project_core (id TEXT, project_name TEXT, "
                       f"updated_at TEXT, total_chapters INTEGER, words_per_chapter INTEGER, {defs})")
            fields = [*bridge.DB_TO_UI, "id", "project_name", "updated_at"]
            values = [100 if x == "total_chapters"
                      else 3000 if x == "words_per_chapter"
                      else "main" if x == "id"
                      else "test-bridge" if x == "project_name"
                      else "date" if x == "updated_at"
                      else "vi-VN" if x == "writing_language"
                      else "" for x in fields]
            db.execute("INSERT INTO project_core (" + ",".join(fields) + ") VALUES ("
                       + ",".join("?" for _ in fields) + ")", values)
            db.commit()

    def _proposal(self, changes):
        f = Path(self.dir.name) / "proposal.json"
        f.write_text(json.dumps({
            "projectId": self.project_id,
            "changes": changes,
            "note": "Thử nghiệm, chưa duyệt."
        }, ensure_ascii=False), encoding="utf8")
        return f

    def test_inspect_only_reads_and_stages_separate_proposal(self):
        before = self.dbfile.read_bytes()
        snap = bridge.snapshot(self.project)
        self.assertEqual(snap["projectId"], self.project_id)
        self.assertEqual(snap["config"]["totalChapters"], 100)
        self.assertEqual(snap["config"]["writingLanguage"], "vi-VN")
        result = bridge.stage(self.project, self._proposal({"coreOutline": "Khởi đầu hành trình."}))
        self.assertEqual(result["status"], "pending_review")
        proposal = json.loads(Path(result["path"]).read_text(encoding="utf8"))
        self.assertEqual(proposal["baseline"]["wordsPerChapter"], 3000)
        self.assertEqual(proposal["changes"]["coreOutline"], "Khởi đầu hành trình.")
        self.assertEqual(self.dbfile.read_bytes(), before)
        with self.assertRaises(FileExistsError):
            bridge.stage(self.project, self._proposal({"coreOutline": "Không ghi đè"}))

    def test_dangerous_fields_blocked(self):
        for patch in ({"totalChapters": 500}, {"writingLanguage": "en-US"},
                      {"__proto__": "x"}, {"coreOutline": ""}):
            with self.assertRaises(ValueError):
                bridge.stage(self.project, self._proposal(patch))
        self.assertFalse((self.project / ".vela" / "story-bridge").exists())

    def test_history_returns_review_feedback_without_writing_database(self):
        before = self.dbfile.read_bytes()
        history = self.project / ".vela" / "story-bridge" / "history"
        history.mkdir(parents=True)
        identifier = "e1f42b1f-41e5-4882-b08d-68a47b149395"
        archived = {
            "proposal": {
                "proposalId": identifier,
                "projectId": self.project_id,
                "changes": {"coreOutline": "Bản cũ"}
            },
            "resolution": {
                "status": "revision_requested",
                "feedback": "Đổi động cơ nhân vật chính.",
                "resolvedAt": "2026-10-10T08:00:00Z",
            }
        }
        (history / (identifier + ".json")).write_text(
            json.dumps(archived, ensure_ascii=False), encoding="utf8")
        result = bridge.history(self.project)
        self.assertEqual(len(result["history"]), 1)
        self.assertEqual(result["history"][0]["status"], "revision_requested")
        self.assertEqual(result["history"][0]["feedback"], "Đổi động cơ nhân vật chính.")
        self.assertEqual(self.dbfile.read_bytes(), before)

    def test_wrong_project_identity_blocked(self):
        data = self._proposal({"coreOutline": "Tóm lược"})
        data.write_text(json.dumps({
            "projectId": "wrong-id", "changes": {"coreOutline": "Tóm lược"}
        }), encoding="utf8")
        with self.assertRaises(ValueError):
            bridge.stage(self.project, data)
        self.assertFalse((self.project / ".vela" / "story-bridge").exists())

if __name__ == "__main__":
    unittest.main()
