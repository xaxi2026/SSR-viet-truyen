# AGENTS.md — SSR-viet truyen

## Project identity

- Product display name: `SSR-viet truyen`.
- Repository slug: `xaxi2026/SSR-viet-truyen` (forked from EthanYoQ/AI-Novel-Writer).
- Keep attribution to upstream `EthanYoQ/AI-Novel-Writer`; do not relabel upstream code as original.

## Mission

Extend upstream AI Novel Writer to Vietnamese without regressing Chinese/English flows. Distinguish `uiLocale` from per-project `writingLanguage`; Vietnamese support is not complete until both work and all core workflow prompts are Vietnamese-native.

## Source of truth

- Upstream: https://github.com/EthanYoQ/AI-Novel-Writer
- Initial audited release: v1.1.0, but verify exact commit when checkout is available.
- Follow the repository's own `CONTRIBUTING.md`, architecture docs, test standards and GPL-3.0 license.
- Preserve author-confirmed facts over model-generated summaries. Never silently convert draft assumptions into canonical story history.
- Avoid unrelated refactors or dependency upgrades while localizing.

## Non-negotiable rules

1. Make changes on issue-linked feature branches; isolate UI locale, writing language, prompts, writing metrics and long-form features into separate PRs.
2. Support `vi-VN`, `en-US`, `zh-CN` without breaking old projects, stored configuration or legacy prompt templates.
3. Never change existing persisted `writingLanguage` by inference from UI locale. New Vietnamese projects can default to `vi-VN`; existing projects retain their language and data.
4. Use explicit Vietnamese translations for all user-facing labels and model instructions. Missing critical Vietnamese prompts must fail in tests instead of silently using Chinese or English instructions.
5. Preserve any JSON schema, runtime input and output contract, validated provenance, chapter/draft IDs and storage format. Only change human-readable instructions or introduce backward-compatible metadata.
6. Keep local-first storage; do not upload private project text or API keys to any service except the model endpoint the author explicitly configures.
7. Do not auto-approve or finalize AI-generated chapters. Require author confirmation for canonical changes and conflicting plot resolutions.
8. Use `Intl.Segmenter('vi', { granularity: 'word' })` where appropriate for user-visible Vietnamese word counts; provide deterministic and tested fallback for environments where unavailable. Define separately the metric used for target length and guardrails.
9. Run `pnpm run typecheck`, `pnpm run check:i18n`, `pnpm test`, `pnpm run lint`; add browser/e2e tests of locale switching, editors, project creation, export and persistence.
10. Before any Windows release, run the upstream packaging validation on Windows and smoke-test a real installer and project upgrade. Never claim success from compilation alone.
11. Do not bypass provider policies; model/provider behavior is distinct from UI locale and writing language.
12. Document limitations, unfinished test coverage and version provenance explicitly.

## Files to examine first

- `src/i18n/types.ts`, `core.ts`, `messages/{en-US,zh-CN}.ts`
- `src/stores/locale-store.ts`, `electron/i18n.ts`, `src/utils/time.ts`
- `src/shared/writing-language.ts`
- `src/services/prompt-language.ts`, `prompt-templates.ts`, `prompt-catalog.ts`, `prompts/prompt-builder.ts`
- `src/services/workflows/commands/refinement-completeness.ts`
- `src/components/editor/CodeMirrorEditor.tsx`, settings and errors surfaces
- `scripts/check-i18n-coverage.mjs` and applicable test files

## Delivery discipline

For each PR: state upstream baseline, changed files, behavior before/after, migration behavior, specific test commands/output, manual UI proof and explicit unresolved issues. Do not mark the story-continuity stage done until the 100-chapter regression set is evaluated with human-reviewed ground truth.

## ChatGPT batch writing requirements

- Read `docs/CHATGPT_BATCH_WRITING_SPEC.md` before implementing batch features; reference `docs/BATCH_101_110_CONFIG.json` for the acceptance case.
- ChatGPT interactive is an external conversational author, NOT an unattended app-side LLM API. Do not assume ChatGPT Plus includes API access or MCP write entitlement.
- Reuse upstream draft versions, project-session leases, resource claims, review, and finalization service; do not write to its DB directly from MCP/Remote tool commands.
- Support restart-safe scene/chapter checkpoints and request idempotency; freeze canonical/bible/blueprint revisions and invalidate stale dependent drafts.
- No batch `auto_finalize`. Require authenticated author approval bound to exact draft hash + review version; never let AI self-approve.
- Chapter 101–110 / 10 chapters / 2,500 Vietnamese visible units each is the reference acceptance scenario, not pre-existing completed content.