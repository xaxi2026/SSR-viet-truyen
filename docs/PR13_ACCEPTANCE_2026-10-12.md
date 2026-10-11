# PR #13 — Windows acceptance evidence (2026-10-12)

**Target:** personal laptop `nghia`; branch `feat/chatgpt-workspace-foundations-20261011`; base commit `7bdc628`.
**Scope:** SSR-viet-truyen foundations only; no master merge, company computer, cloud copy of private fiction, or generation of actual additional test-1 chapters.

## Test fixture and isolation

- Source novel `test-1` was used **read-only**.
- Verified an existing 31-file backup and restored into the independent
  `_acceptance/test-1-pr13-20261012` project folder.
- Electron launched by Playwright with an isolated `AI_NOVEL_VELA_HOME`
  and user data directory; smoke-open marker explicitly identified the
  **restored copy**, not the original.
- The native Save dialog was stubbed **inside this test-only Electron
  process**, to choose a ZIP filename inside the acceptance directory.
  All other backup controller, active database connection, archive service
  and click path were real.
- Fixture and screenshots remain only on the personal laptop, under
  `D:\SSR-truyen test\_acceptance\`, **not committed to GitHub**.

## Measured results

| Check | Status | Evidence |
|---|---|---|
| Python backup `verify` | PASS | 31 files; per-file SHA-256 checked |
| Python restore to fresh directory | PASS | SQLite `integrity_check=ok`; one finalized chapter |
| Electron project opening | PASS | smoke project-open marker targeted restored copy |
| Electron toolbar Backup | PASS | Button enabled and clicked; actual ZIP written (387,164 bytes) |
| GUI ZIP cross-tool `verify` | PASS | 31 files and valid SHA-256 manifest |
| Restore from GUI-created ZIP | PASS | Second project, SQLite `integrity_check=ok`, manuscript preserved |
| Finalized manuscript reader | PASS | Chapter 1 opened from **Manuscript chapters** tree; reader had 11,891 visible characters |
| Reader font increase and close | PASS | 20px → 22px, then returned to original locked editor |
| Batch staging / dry run | PASS | Synthetic chapter range 2–3 on **restored second copy** |
| Batch scene idempotency | PASS | First call new, second call same key/hash returned `idempotent=true` |
| Batch candidate never becomes published draft | PASS | SQLite still has only chapter 1 `finalized` after submit |
| ChatGPT-deferred `kb_import` unit | PASS | Provider runtime never initialized; no notes/card AI calls |
| Stale finalized receipt rejection | PASS | No KB/LLM calls on stale receipt |
| Knowledge-base failure propagation | PASS | Explicit error, not silent success |
| Original `test-1` safety | PASS | SQLite SHA-256 remained `6bdb940e124eb4c9705fb6f8cb8caf96fc35b28692df5bf1568035692a015f9c`; integrity `ok` |
| Synthetic Python tests | PASS | 5/5 |
| GUI ZIP service tests | PASS | 2/2 |
| Deferred finalization tests | PASS | 3/3 |

Screenshots (private laptop): `_acceptance/evidence/01-open-project.png`,
`02-backup.png`, `03-reader.png`, and `summary.json`.

## Important qualifications

1. The first E2E attempt timed out because its locator clicked the *draft
   box chapter group* instead of the finalized manuscript row. The test
   selector was corrected; the next full Electron run passed. This was
   a **test harness defect**, not confirmed as a product reader failure.
2. The Electron file picker was simulated to prevent arbitrary Save locations.
   A final manual Windows native-dialog check remains open.
3. `chapter_notes` and `character_cards` are **deferred**, not synthesized
   via ChatGPT automatically. Native author-review proposals are still Issue #14.
4. Batch is only a checkpointed staging CLI; **no native DraftRepository import
   or ChatGPT-connected batch GUI** yet (Issue #3).
5. Restore has been tested with the Python CLI, not a built-in app Restore
   button; that is Issue #15.
6. Reader navigation, bookmarks, and persisted reading position remain Issue #16.
7. The suite of SQLite integration tests using Node-native `better-sqlite3`
   is blocked by Electron-vs-Node ABI mismatch in current `node_modules`.
   Do not silently rebuild or replace the live Electron binding to force a pass.
8. This is not approval to merge PR #13. Windows packaged installer smoke,
   non-stubbed native dialog, old-language compatibility, and a complete
   canonical-memory workflow still require separate signoff.

## Reproduction

```powershell
# Point strictly to an existing isolated acceptance copy.
$env:SSR_PR13_ACCEPTANCE_ROOT = 'D:\SSR-truyen test\_acceptance'
node scripts/ssr-pr13-acceptance-e2e.mjs
node node_modules/vitest/vitest.mjs run electron/services/__tests__/ssr-project-archive.test.ts src/services/workflows/commands/__tests__/finalize-chatgpt-deferred.test.ts
python -X utf8 scripts/test_ssr_workspace_foundations.py
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```
