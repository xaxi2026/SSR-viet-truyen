#!/usr/bin/env python3
"""Create a synthetic multi-finalized-chapter project inside _acceptance ONLY.

Never write to the original novel. The source MUST already be an acceptance
project copy, and no synthetic chapter is intended for story generation.
"""
from __future__ import annotations

import argparse
import datetime
import pathlib
import shutil
import sqlite3


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acceptance-root", required=True, type=pathlib.Path)
    args = parser.parse_args()
    base = args.acceptance_root.resolve()
    if "_acceptance" not in str(base).lower() or not base.is_dir():
        raise ValueError("Only a local _acceptance directory may be used")
    source = base / "test-1-pr13-20261012"
    original_db = source / ".vela" / "vela.db"
    if not original_db.is_file():
        raise ValueError("Pre-restored acceptance project copy missing")
    target = base / ("_reader-synthetic-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f"))
    if target.exists():
        raise FileExistsError("Refusing to overwrite synthetic fixture")
    # Snapshot SQLite using its online backup API, do not copy live WAL.
    def ignore(directory: str, names: list[str]) -> set[str]:
        if pathlib.Path(directory).resolve() == (source / ".vela").resolve():
            return set(names) & {"vela.db", "vela.db-wal", "vela.db-shm", "vela.db-journal"}
        return set()
    shutil.copytree(source, target, ignore=ignore)
    try:
        with sqlite3.connect(original_db.as_uri() + "?mode=ro", uri=True) as src:
            with sqlite3.connect(target / ".vela" / "vela.db") as db:
                src.backup(db)
                for chapter in (2, 3):
                    body = "\n\n".join(
                        f"Synthetic QA paragraph {i} for chapter {chapter}. "
                        "This text only tests reading navigation, and is not a real story chapter."
                        for i in range(1, 81)
                    )
                    content_id = db.execute("INSERT INTO contents (body) VALUES (?)", (body,)).lastrowid
                    db.execute(
                        "INSERT INTO drafts (chapter_number, version, status, source, content_id, "
                        "word_count, source_dependencies) VALUES (?, 1, 'finalized', 'import', ?, ?, '[]')",
                        (chapter, content_id, len(body.split())),
                    )
                if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Synthetic fixture failed SQLite integrity check")
                db.commit()
    except BaseException:
        shutil.rmtree(target, ignore_errors=True)
        raise
    (base / "reader-multi-fixture-path.txt").write_text(str(target), encoding="utf-8")
    print(f"SYNTHETIC_QA_ONLY={target}")


if __name__ == "__main__":
    main()
