# SSR-viet-truyen Reader completion — 2026-10-13

## What is now implemented

This extends the previously accepted read-only manuscript reader (Issue #16)
without implementing text-to-speech/audio.

1. **Dedicated reading surface** for finalized chapters only. Existing manuscript
   and draft editor repositories are untouched.
2. **Project-scoped reading TOC** lists only finalized drafts, ordered by chapter
   number, with filtering by title/number and per-chapter reading progress.
3. **Previous/Next** through finalized chapters only, including shortcuts
   `Alt+Left` and `Alt+Right`. A completed chapter tab is closed after opening
   the next finalized chapter to avoid hundreds of tabs accumulating.
4. **Continue reading** action beside `Manuscript chapters` returns to the last
   finalized chapter, including across application restart.
5. **Bookmarks** at multiple scroll positions, jump-to-position and removal.
   A limit of 50 bookmarks per chapter avoids unbounded local metadata.
6. **Search in current chapter** filters matching paragraphs, highlights terms
   and jumps to selected result. Manuscript content is never indexed to the cloud.
7. **Reader preferences**: font size 14–34 px, line height 1.4–2.4, page width,
   paper/sepia/night reading themes. Compatible with prior v1 local preferences.
8. **Focus mode** fills the application's window (not native OS fullscreen),
   Escape to exit, with a visible exit control.
9. **Position and preferences persist locally** on the same device. Progress is
   project-and-manuscript scoped, with no novel text copied to browser storage.
   No cross-machine synchronization or audio is implemented.

## Actual verification on personal laptop `nghia`

Scope: Git branch `feat/chatgpt-workspace-foundations-20261011`; all GUI work
in isolated Electron user-data and `AI_NOVEL_VELA_HOME`. The input project
for ordinary reader tests is **only** the previously restored `_acceptance`
copy of `test-1`.

- `scripts/ssr-reader-complete-e2e.mjs`:
  **SSR_READER_COMPLETE_E2E_PASS**. Clicked Continue reading, TOC filter,
  within-chapter search/highlight, bookmark, night theme, font/width settings,
  focus mode + Escape, reader close/reopen persistence of font, theme,
  60% scroll position and bookmark.
- `scripts/ssr_reader_synthetic_fixture.py` creates a **fresh synthetic
  acceptance-only clone** using SQLite online backup, then adds **two purely
  synthetic, non-story** finalized chapters 2 and 3. Never writes to the
  original novel or to the accepted source copy.
- `scripts/ssr-reader-multi-e2e.mjs`:
  **SSR_READER_MULTI_E2E_PASS**. Moved 1→2 via TOC, 2→3 via Next, 3→2 via
  Previous, 2→3→2 via Alt+arrows, then closed and restarted Electron and used
  Continue reading to reopen chapter 2.
- Original `scripts/ssr-pr13-acceptance-e2e.mjs` regression:
  **PR13_E2E_PASS**. One finalized original chapter, no manuscript writes.
- Restore regression `scripts/ssr-pr15-restore-e2e.mjs`:
  **PR15_GUI_RESTORE_PASS**, backed by isolated test-process native dialog stubs.
- Focused Vitest for this and related code:
  **16/16 PASS**, including 7 reader-specific cases.
- Full TypeScript, ESLint, Vite/Electron build and i18n coverage:
  **PASS**; synthetic Python workspace tests **5/5 PASS**.

## Known limitations / release gates

- Reading progress/bookmarks currently persist **per computer** in Electron's
  local browser storage. They do not automatically synchronize between laptop
  and office computer. Do not manually copy app browser profiles.
- Only **finalized chapters** appear in the reader; 500 approved outlines are
  not 500 completed chapters. The original `test-1` still has one finalized
  chapter.
- No TTS/audio in this scope; no remote backend or AI model needed to read.
- Windows native file picker and packaged installer still require manual QA
  before promoting Draft PR #13.
- Large catalog stress test (all 500 finalized chapters) and accessibility
  review remain possible enhancements, not claimed as completed.
- Legacy native SQLite Node integration suite was not run because of the
  existing Node/Electron better-sqlite3 ABI mismatch.

Screenshots and private data remain only on `D:\SSR-truyen test\_acceptance`
on the home laptop. Original SQLite SHA-256 should remain
`6bdb940e124eb4c9705fb6f8cb8caf96fc35b28692df5bf1568035692a015f9c`.
No office computer changes, no real new chapters, and **no GitHub merge**.
