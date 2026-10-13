# SSR-viet-truyen: ChatGPT Story Continuity Import (isolated home pilot)

## Scope

Built on `feat/linked-foreshadowing-tracks-20261013` (draft PR #19).
Adds a manually confirmed 7 / 13 / 8 import preview to the **Sơ đồ cốt truyện** screen.
This pilot does not change existing users' application or projects automatically.

The author places `SSR_CHATGPT_CONTINUITY_IMPORT.json` inside the chosen novel's
`_bien_tap_cho_duyet` directory. The importer requires the current `projectId`,
the proposal-only status, a matching schema, 7 Story Bible proposals,
13 clue proposals, and 8 macro tracks.

It presents the private canonical truths only in an author-specific disclosure,
and does not insert private truth into AI prompts. No event marked "planted",
"progressing", "resolved", or "abandoned" is created by the importer.

## Open milestones

The original data intentionally includes 19 undecided chapter numbers.
The native `story_bible_entries.reveal_chapter` and
`narrative_thread_plans.target_end_chapter` still require integers.
Therefore **do not fake a chapter number or use the final chapter as a default**.

The button **Lưu tiến độ — giữ mốc chưa chốt** writes
`_bien_tap_cho_duyet/SSR_CHATGPT_CONTINUITY_REVIEW.json` in review-only
state. It does not write SQLite. Import is limited to entries with
author-confirmed valid chapters. Clues linked to a still-unresolved Bible
record stay deferred. The author must separately confirm that a backup exists
and accept a final native prompt before any SQLite write.

The importer uses existing SSR project-session IPC endpoints and
native repositories. If interrupted midway, rerunning skips exact matching
entries; conflicting same-title records block instead of overwriting.
It is not an all-or-nothing SQLite transaction across 28 records.

## Home rollout

Develop and build in a separate Git worktree. The original Writer checkout,
`test-1`, and original novel stay untouched until the author explicitly
opens and imports into a chosen novel. Keep the user's private JSON and
SQLite files out of public GitHub.

Validation on the home machine: TypeScript `tsc --noEmit`, targeted ESLint,
`check-i18n`, Vite Electron production build, and Story Bible unit tests
passed. The local Electron Pilot launcher was started with a separate
user-data profile. Full Windows installer and 200-chapter regression evaluation
remain outside this pilot's scope.

Do not merge this branch or PR #19 without explicit author acceptance.
