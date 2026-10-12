# SSR-viet-truyen: PR #13 Restore & Reader qualification — 2026-10-12

## Scope and isolation

- Device: **nghia only**, personal laptop.
- Git branch: `feat/chatgpt-workspace-foundations-20261011`, existing **Draft PR #13**.
- The original novel `D:\SSR-truyen test\test-1` was never opened in a writable app session, nor altered by any of these tests.
- Electron smoke uses **only** `D:\SSR-truyen test\_acceptance\test-1-pr13-20261012` as the initial project, isolated `AI_NOVEL_VELA_HOME` and Electron user-data path.
- Python/Playwright screenshots, private test data and restored project folders remain under `D:\SSR-truyen test\_acceptance` and are not added to Git.

## Restore implementation — Issue #15

- New title-bar `Khôi phục / Restore` action, which works even with no project opened.
- Only the **Electron main process** may choose source ZIP and destination parent through native dialogs. No renderer path argument or arbitrary extraction path.
- Main process verifies the SSR manifest and every entry's CRC32 and SHA-256, refuses ZIP-slip/absolute/Windows reserved/case-colliding paths and symlinks, checks bounds and counts before writing any files.
- Supports the GUI-compatible **ZIP32** format; max 256 MiB per member, 2 GiB total raw bytes, 20,000 project files. Larger/ZIP64 backups need separate tooling; do not advertise them as supported by GUI Restore.
- Main process confirms the generated **new** destination path, reserves that path with exclusive mkdir, never overwrites, and deletes only its own unfinished directory on failure.
- Validates restored `better-sqlite3` database `PRAGMA integrity_check` before success.
- Renderer offers to **open** the newly restored project using existing `project:open` project-session workflow, not an automatic DB switch.

**Windows Electron E2E:** `scripts/ssr-pr15-restore-e2e.mjs` printed
`PR15_GUI_RESTORE_PASS`. It clicked Restore, obtained the ZIP and parent through mocked **only the two OS dialogs** in a private Electron test process, allowed the confirmation, restored and **opened** the new project. Screenshot evidence is stored privately in
`_acceptance/evidence/04-restore-dialog.png` and `05-restored-opened.png`.

**Read-only database audit** (original vs new project): both returned
`integrity_check = ok`, 10 imported blueprints, one chapter 1 finalized
(2,625 Vietnamese units), one published finalization and 33 regular files.
The source SQLite SHA-256 remained
`6bdb940e124eb4c9705fb6f8cb8caf96fc35b28692df5bf1568035692a015f9c`.

**Restore service unit tests**: 4/4 — valid ZIP roundtrip, tamper rejection, ZIP-slip rejection, active project boundary/cleanup. Backup writer service tests: 2/2.

## Reader improvements — Issue #16

- Read-only mode now remembers **font size and line spacing** locally.
- Per-project/per-manuscript **reading progress** is saved in renderer `localStorage` as a scroll fraction, without copying manuscript text or modifying SQLite.
- Previous/Next buttons navigate only ordered **finalized** chapters in the project-bound draft store; draft chapters are excluded. Reader mode stays active while moving between chapters.
- An index from a different project session is rejected; a missing/single finalized chapter disables the navigation buttons.

**Windows Electron E2E:** `scripts/ssr-pr13-acceptance-e2e.mjs` printed
`PR13_E2E_PASS`. Reader increased font from 22 to 24 px, scrolled to
55%, switched to manuscript editor and back, and restored **24 px / 55%**
correctly. Chapter 1 was the only finalized chapter, so both navigation
buttons were disabled. Synthetic pure navigation unit tests: 3/3
(prev/next skip drafts and use chapter order, cross-project rejection,
single-chapter behavior).

**Not yet qualified:** a real 2+ finalized-chapter UI navigation session;
one-chapter `test-1` has not been modified to manufacture extra chapters.

## Verification and remaining gates

- Focused automated unit checks: **12/12 PASS** (4 restore, 2 backup,
  3 reader navigation, 3 ChatGPT-deferred).
- Python synthetic workspace tests: **5/5 PASS**.
- Full TypeScript `tsc --noEmit`, ESLint, Vite/Electron compilation: **PASS**.
- ZIP verification by Python CLI was already confirmed in the earlier
  `PR13_ACCEPTANCE_2026-10-12.md` record.
- **Manual Windows dialog interaction** and packaged Windows app/installer
  smoke are still required. The E2E stubs system picker dialogs but invokes
  real controller/SQLite/restore/archive and project-opening code.
- Full legacy SQLite integration suite has Node/Electron native ABI mismatch;
  do not rebuild `better-sqlite3` in-place. This remains unqualified.
- ChatGPT memory/character proposals (Issue #14) and native Batch Writer
  importer/approvals (Issue #3) remain separate work.

**No GitHub merge, no office computer access, no actual story chapter creation.**
