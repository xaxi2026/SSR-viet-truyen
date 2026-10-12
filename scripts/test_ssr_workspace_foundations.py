#!/usr/bin/env python3
"""Regression tests for local-only backup and ChatGPT batch checkpoint contracts."""
import json
from contextlib import closing
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

from ssr_project_archive import backup, restore, verify
from ssr_chatgpt_batch import create, append, submit, read_state, batch_path


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ssr-foundations-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.project = self.base / "novel"
        (self.project / ".vela").mkdir(parents=True)
        (self.project / ".vela" / "project.json").write_text(
            '{"schemaVersion":1,"kind":"novel","projectId":"test-project"}', encoding="utf-8")
        with sqlite3.connect(self.project / ".vela" / "vela.db") as db:
            db.executescript("""
              create table blueprints(chapter_number integer primary key);
              create table drafts(chapter_number integer, status text);
              insert into blueprints values(1),(2),(3);
              insert into drafts values(1,'finalized');
            """)
        db.close()
        (self.project / "chapter_1.txt").write_text("Chương 1 đã chốt", encoding="utf-8")

    def test_archive_restore_and_verify(self):
        archive = self.base / "back.zip"
        receipt = backup(self.project, archive)
        self.assertTrue(receipt["verified"])
        self.assertTrue(verify(archive)["verified"])
        other = self.base / "restore"
        self.assertTrue(restore(archive, other)["verified"])
        self.assertEqual((other / "chapter_1.txt").read_text(encoding="utf-8"), "Chương 1 đã chốt")
        with self.assertRaises(FileExistsError):
            restore(archive, other)

    def test_archive_detects_tamper(self):
        archive = self.base / "back.zip"
        backup(self.project, archive)
        with zipfile.ZipFile(archive, "a") as z:
            z.writestr("extra-injected-file", "bad")
        with self.assertRaises(ValueError):
            verify(archive)

    def test_batch_resume_idempotent_and_submit(self):
        self.assertTrue(create(self.project, "smoke", 2, 2, True)["dryRun"])
        create(self.project, "smoke", 2, 2, False)
        text = self.base / "scene.txt"
        text.write_text("Lục Hoài An tiếp tục cuộc hành trình.", encoding="utf-8")
        one = append(self.project, "smoke", 2, 1, text, "scene-1")
        self.assertFalse(one["idempotent"])
        self.assertTrue(append(self.project, "smoke", 2, 1, text, "scene-1")["idempotent"])
        state = read_state(batch_path(self.project, "smoke"))
        self.assertEqual(len(state["scenes"]["2"]), 1)
        text.write_text("Changed text", encoding="utf-8")
        with self.assertRaises(ValueError):
            append(self.project, "smoke", 2, 1, text, "scene-1")
        completed = submit(self.project, "smoke", 2)
        self.assertIn("NOT an app draft", completed["note"])
        self.assertEqual(read_state(batch_path(self.project, "smoke"))["activeChapter"], 3)

    def test_batch_never_overwrites_existing_drafts(self):
        with sqlite3.connect(self.project / ".vela" / "vela.db") as db:
            db.execute("insert into drafts values(2,'draft')")
        db.close()
        with self.assertRaises(ValueError):
            create(self.project, "collision", 2, 2, True)

    def test_batch_needs_previous_finalized_and_blueprint(self):
        with self.assertRaises(ValueError):
            create(self.project, "gap", 3, 1, True)
        with self.assertRaises(ValueError):
            create(self.project, "missing", 4, 1, True)


if __name__ == "__main__":
    unittest.main()
