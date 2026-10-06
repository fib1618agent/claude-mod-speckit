# Session Handoff — Spec-Kit SDD Mods (updated 2026-10-06, end of session 2)

Start the next session by reading this file, then do **"Next step"** below. Nothing else is pending that blocks it.

## Next step (agreed, start here)
Per-Mod READMEs are **done** (`mods/00`…`10`, each with prose plus Reads/Stores/Sends). `claude plugin validate` passes 12/12 plus the marketplace; `sync:check`, `validate` and `npm test` pass.

Remaining, done by the user in the portal (Claude cannot submit): submit via https://claude.ai/directory/manage in two batches (max 10 per 24 h). Batch 1: `00`–`09`. Batch 2 (next day): `10`, `11`. Nothing has been submitted yet. Before submitting, ideally run an interactive session on a real Spec-Kit project with all Mods.

## State
- Repo: https://github.com/fib1618agent/claude-mod-speckit (public), branch `main`, clean, pushed. Last commit `0a31ea9`.
- 12 Mods under `mods/` (00 Navigator, 01–10 capability Mods, 11 content-only Prompt Pack). Specs `00`–`11-*.md` at repo root are amended and match the code (six wording deltas applied in `6b0afa7`).
- Verified: `tsc` 11/11, `claude plugin validate` 12/12 plus the marketplace manifest, 148 harness tests, real-engine run on a Spec-Kit 1.1.0 fixture. Readiness: **ready with caveats**.
- Root files: `README.md` (badges, what a Mod is, screenshot, Install, Use, Mods table, develop, status, license), `LICENSE` (MIT © 2026 fib1618agent), `.claude-plugin/marketplace.json` (marketplace `sdd-mods`, 12 plugins, sources `./mods/<folder>`), `screenshots/claude-mod.png`.
- Every `plugin.json` has name, version `0.1.0`, description, author, homepage, repository, license `MIT`, `types`.
- Scripts in `mods/scripts/`: `sdd-claude.sh` (session-only load via `--plugin-dir`), `install-local.sh` / `uninstall-local.sh` (global install via the local `claude-mods-local` marketplace), `sync-shared.mjs`, `each-plugin.mjs`.

## Machine state (this Mac only)
- All 12 Mods are **installed globally** (user scope) from `~/.claude/local-mods/` (copies, marketplace `claude-mods-local`; backup `marketplace.json.bak` beside it). They do not track the repo: re-run `mods/scripts/install-local.sh` after code changes, undo with `uninstall-local.sh`.
- The Review Gate (`03`) therefore intercepts `/speckit-*` in every project on this Mac.
- Git identity is **repo-local** only: `fib1618agent <fib1618agent@gmail.com>`. A fresh clone elsewhere will use whatever global git config exists; set it again if wanted.
- Commit footer used: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Directory facts (read from the official docs on 2026-10-06; the pasted guide the user supplied was partly outdated)
Sources: `claude.com/docs/directory/publish`, `/docs/plugins/pre-submission-checklist`, `/docs/plugins/submit`. `clau.de/plugin-directory-submission` just redirects to the publish page.
- Portal: **https://claude.ai/directory/manage** (the old Console form is unsupported). Needs a Pro/Max/Team/Enterprise claude.ai account, GitHub connected in that org, and push access to the repo. Repo must be public before the listing goes live (it is).
- **One submission per plugin folder** → 12 submissions. Limit **10 per 24 h** (drafts and withdrawals count) → two batches on two days.
- Flow: Submit new → Plugin bundle → Source (repo, plugin path e.g. `mods/03-prompt-review-gate`, optional branch) → **Validate** → listing details (read from `plugin.json` + README) → data-handling questions → compliance (contact email, 4 acknowledgements) → choose GitHub push webhook or scheduled check → Submit for review. Then automated scan, human review of a new listing, then Publish (reviewer publishes by default).
- Updates: merge to the tracked branch; if `version` is set in `plugin.json`, **bump it every release** or users keep the cached version. No 1.0.0 requirement.
- Checklist items that matter here:
  - README ≥ 40 words in each plugin folder, **Blocks** (only `11` has one).
  - License via `license` field or `LICENSE` file: done.
  - Name should be distinctive; generic `sdd-*` names may be **held for a reviewer** (not rejected).
  - Mods are supported: `hooks/hooks.json` with a `modules` array is valid. Ours is `{ "modules": ["./register.tsx"] }`.
  - Plugin is a subfolder of the repo, so non-shell scripts run by hooks may be **held** ("Scripts the validator couldn't follow"). Expect human review.
  - Files: non-image/font files under 256 KiB, at most 512 files, text only; no binaries. `.DS_Store` blocks. Everything a plugin uses must be inside its own folder (that is why `_shared` is copied into `hooks/shared/` by `npm run sync`).
  - Security scan wants behavior disclosed in the README and readable (not minified) source.
  - Each plugin README should state anything it stores (`$.store` per user, project-keyed; project data in `.speckit/mod/`).
- Recommended extra checks before submitting: `claude plugin eval` exists for comparing output with and without a plugin; test a clean install of the marketplace path from the README on a machine without the global install.

## Architecture decisions that must not be silently reversed
- One Navigator (outer hook, embeds capability views); fallback = one pane at a time (`sdd-view`), auto-selected when a view fails to appear.
- `03` is the sole interceptor and approval entry; `06` sole Approve/Reject/Continue; `05` sole artifact/staleness owner; `07` sole ID graph; `02` sole template edit/save/reset; `10` aggregate/delegate only; `11` content only.
- `03` ≠ `04` (separate plugins; a plugin-origin submission bypasses the submitter's own hooks).
- Hotkeys are focus-scoped: `1–9`, `0`, `p` open views, `b` Back, `Esc` closes the pane. No global shortcuts.
- No invented quality score. Unknown/missing/unanswerable approval fails closed. Approval-class `/sdd-review` subcommands (`run`, `edit`, `cancel`, `save`) need a human origin.
- `$.store` is per user: every record is project-keyed. Project data lives in `.speckit/mod/`.
- No `sdd-contracts` plugin; no `dependencies` in `plugin.json` (soft edges stay soft; types via workspace tsconfig).

## Verified runtime facts (Claude Code 2.1.289, Spec-Kit 1.1.0)
- Typed `/speckit-x` → `command.run` → `skill.prompt` → `prompt.submit`; model-invoked → `tool.call` `Skill`. `{text}`/`{drop}`/`{deny}` each stop it.
- `$.command.run` rejects inside an awaited hook; works from timers/later events; target sees `origin {kind:'plugin', name}`.
- Another plugin's `prompt.submit` hook sees plugin-origin submissions; the submitter's own are skipped.
- `Input` is single-line → `$.prompt.fill` is the edit path. `ui.close` hook refuses with `{deny}`.
- Validator: `$` only to same-file top-level functions; `$.state.get/set` need literal-const refs.
- Harness: inline plugins self-contained; host enforces state ownership; paths with `..` are normalized.
- Full detail in memory files `sdd-mods-spike-results.md` and `sdd-mods-implementation-status.md` (under `~/.claude/projects/-Users-imdadareeph-Downloads-claude-mods-claude-mod-speckit/memory/`; **not available if the new session runs in a different folder**, so this file carries the essentials).

## Still open (from the earlier handoff; unchanged unless noted)
- **Not runtime-verified:** real-session plugin load order; Button `onPress` → `$.command.run`; person-origin Esc; interactive-TUI routing of `/speckit-*`; surfaces other than terminal. An **interactive session on a real Spec-Kit project with all Mods** is still the biggest remaining check (the `/sdd` pane itself was seen working, see `screenshots/claude-mod.png`). Do it before the first directory submission if possible.
- **Functional gaps (caveats, not bugs):** `06` per-phase rules are constants (only analyze-before-implement, `approvalRequired`, `scoreFormula` configurable); `enabled:false` honoured only by `03` and `09`; no Mod reports config-section validation errors; Buttons not built: `05` Open artifact, `07` Review Gap/Open Source, `08` Mark exception (use `/sdd-converge except <scope> <reason>`), `09` Open item, `10` Review/Edit Prompt/Status; `05` artifact→phase map is a constant.
- README caveat: the "Mods support" requirement wording is unverified (unknown whether a user must enable anything). The screenshot shows "Sonnet 3.5" and an unrelated newsletter watermark top-right; consider re-cropping or retaking.

## Commands
```bash
cd mods
npm run sync && npm run sync:check
npm run typecheck     # needs each plugin loaded once so the engine lays .claude-plugin/types
npm run validate      # claude plugin validate per plugin
npm test              # claude plugin test per plugin (148 tests)
cd .. && claude plugin validate .            # marketplace manifest
mods/scripts/sdd-claude.sh                   # from a Spec-Kit project: session-only load
```

## Gotchas
- Headless `claude -p` stream-json drivers: write the child's stdout to a file; plugin-queued commands make later outputs unreliable there, read the debug log (`--debug-file`) or the transcript instead.
- `claude plugin test` needed one headless `claude -p` run first to refresh the hooks rollout switch.
- `.claude-plugin/types/` appears only after a plugin is loaded once from a folder and is git-ignored; `npm run typecheck` fails until then. Do not commit it (files are large).
- `node_modules/` and `.DS_Store` are git-ignored; `.DS_Store` inside a plugin folder would **block** directory validation.
- After editing `mods/_shared/*.ts`, run `npm run sync` or `sync:check` fails.
- e2e runs write plugin stores under `~/.claude/plugins/store/` (project-keyed); safe to delete.
- Rewrote history once (force-push) to reword the first two commits; the repo is single-author, so no one else is affected.
