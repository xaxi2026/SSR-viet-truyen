#!/usr/bin/env python3
"""Local-only SSR project backup/restore (standard library, no AI, no network).

Backups use SQLite's online backup API; restore NEVER overwrites an existing project.
Run when SSR is closed to ensure non-SQLite indexes are also consistent.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

SCHEMA = "ssr-project-archive-v1"
MAX_ENTRY_BYTES = 1_000_000_000
MAX_ARCHIVE_BYTES = 8_000_000_000
MAX_FILES = 100_000
EXCLUDE_NAMES = {"vela.db-wal", "vela.db-shm", "vela.db-journal"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_relative(value: str) -> Path:
    p = PurePosixPath(value)
    if (
        not value or value.startswith("/") or "\\" in value
        or any(part in ("..", ".", "") for part in p.parts)
        or p.is_absolute() or ":" in value
    ):
        raise ValueError("Unsafe archive path")
    return Path(*p.parts)


def source_files(project: Path):
    for path in sorted(project.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlinks are forbidden: {path}")
        if not path.is_file() or path.name.lower() in EXCLUDE_NAMES:
            continue
        relative = path.relative_to(project).as_posix()
        if relative == ".vela/vela.db":
            continue
        yield relative, path


def backup(project: Path, output: Path) -> dict:
    project, output = project.resolve(), output.resolve()
    db_file = project / ".vela" / "vela.db"
    if not (project / ".vela" / "project.json").is_file() or not db_file.is_file():
        raise ValueError("Not an SSR project (.vela/project.json and .vela/vela.db required)")
    if output.is_relative_to(project):
        raise ValueError("Backup must be outside project directory")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite backup: {output}")
    if not output.parent.is_dir():
        raise ValueError("Backup parent directory does not exist")
    manifest = {"schema": SCHEMA, "files": {}, "snapshot": "sqlite-online-backup"}
    with tempfile.TemporaryDirectory(prefix="ssr-backup-") as scratch:
        clean_db = Path(scratch) / "vela.db"
        source = sqlite3.connect(db_file.as_uri() + "?mode=ro", uri=True)
        try:
            target = sqlite3.connect(clean_db)
            try:
                source.backup(target)
                if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("SQLite backup integrity check failed")
            finally:
                target.close()
        finally:
            source.close()
        pending = output.with_name(output.name + ".incomplete")
        if pending.exists():
            raise FileExistsError(f"An incomplete backup already exists: {pending}")
        try:
            with zipfile.ZipFile(pending, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=5, allowZip64=True) as z:
                entries = list(source_files(project))
                entries.append((".vela/vela.db", clean_db))
                if len(entries) > MAX_FILES:
                    raise ValueError("Too many files")
                for relative, file_path in sorted(entries):
                    data = file_path.read_bytes()
                    if len(data) > MAX_ENTRY_BYTES:
                        raise ValueError(f"File too large: {relative}")
                    manifest["files"][relative] = {"bytes": len(data), "sha256": sha256(data)}
                    z.writestr(relative, data)
                z.writestr("ssr-backup-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            verify(pending)
            os.replace(pending, output)
        finally:
            if pending.exists():
                pending.unlink()
    return {"archive": str(output), "files": len(manifest["files"]), "verified": True}


def verify(archive: Path) -> dict:
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Archive too large")
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        if len(names) > MAX_FILES + 1 or len(names) != len(set(names)):
            raise ValueError("Duplicate or excessive archive entries")
        if "ssr-backup-manifest.json" not in names:
            raise ValueError("Missing manifest")
        manifest = json.loads(z.read("ssr-backup-manifest.json"))
        if manifest.get("schema") != SCHEMA:
            raise ValueError("Unsupported manifest schema")
        files = manifest.get("files")
        if not isinstance(files, dict) or set(files) != (set(names) - {"ssr-backup-manifest.json"}):
            raise ValueError("Manifest entries differ from archive")
        total = 0
        for name, spec in files.items():
            safe_relative(name)
            info = z.getinfo(name)
            if info.is_dir() or info.file_size > MAX_ENTRY_BYTES:
                raise ValueError("Unexpected directory or oversized file")
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Symlink entry forbidden")
            total += info.file_size
            if total > MAX_ARCHIVE_BYTES:
                raise ValueError("Uncompressed content too large")
            data = z.read(name)
            if len(data) != spec["bytes"] or sha256(data) != spec["sha256"]:
                raise ValueError(f"Archive hash mismatch: {name}")
        if ".vela/vela.db" not in files or ".vela/project.json" not in files:
            raise ValueError("Project metadata missing")
    return {"archive": str(archive), "files": len(files), "verified": True}


def restore(archive: Path, destination: Path) -> dict:
    verify(archive)
    destination = destination.resolve()
    if destination.exists():
        raise FileExistsError("Restore never overwrites an existing directory")
    if not destination.parent.is_dir():
        raise ValueError("Restore parent directory does not exist")
    tmp = Path(tempfile.mkdtemp(prefix="ssr-restore-", dir=destination.parent))
    try:
        with zipfile.ZipFile(archive) as z:
            manifest = json.loads(z.read("ssr-backup-manifest.json"))
            for name in manifest["files"]:
                target = tmp / safe_relative(name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(name))
        with closing(sqlite3.connect((tmp / ".vela" / "vela.db").as_uri() + "?mode=ro", uri=True)) as db:
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("Restored SQLite integrity check failed")
        os.rename(tmp, destination)
    finally:
        if tmp.exists():
            shutil.rmtree(tmp)
    return {"restored": str(destination), "verified": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)
    p = modes.add_parser("backup")
    p.add_argument("--project", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p = modes.add_parser("verify")
    p.add_argument("--archive", type=Path, required=True)
    p = modes.add_parser("restore")
    p.add_argument("--archive", type=Path, required=True)
    p.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    result = backup(args.project, args.output) if args.mode == "backup" else (
        restore(args.archive, args.destination) if args.mode == "restore" else verify(args.archive)
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
