# Session Handoff — Spec-Kit SDD Mods (2026-10-06)

## State in one paragraph
All twelve SDD Mods exist under `mods/` (00 Navigator, 01–10 capability Mods, 11 content-only Prompt Pack). Specs `00`–`11` were amended to a Navigator-aware architecture, spikes A–G were run, four spec amendments were approved and applied, and production code was built. Verified: `tsc` 11/11, `claude plugin validate` 12/12, 148 harness tests passing, plus a real-engine run on a real Spec-Kit 1.1.0 fixture. **Readiness: READY WITH CAVEATS.** Nothing is committed (repo is not a git repository).

## Where things are
| Path | What |
|---|---|
| `00`…`11-*.md` (repo root) | Architectural source of truth (amended). |
| `AMEND-SPECKIT-MODS.md`, `AMEND-SPECKIT-MODS-APPROVED.md` | The amendment briefs (not part of the 12). |
| `mods/` | Implementation. `mods/README.md` explains layout, load command, tooling. |
| `mods/_shared/*.ts` | Pure helpers; `npm run sync` copies them into each plugin's `hooks/shared/` (plugins cannot import across folders). |
| `mods/scripts/` | `sync-shared.mjs`, `each-plugin.mjs`. |
| Memory: `sdd-mods-spike-results.md`, `sdd-mods-implementation-status.md` | Verified API facts and gotchas. |
| Scratchpad `…/scratchpad/spike/` | Throwaway PoCs and the real Spec-Kit fixture `sk-fixture/` (session-temporary; safe to lose). |

## Commands
```bash
cd mods
npm run sync && npm run sync:check
npm run typecheck     # needs each plugin loaded once so the engine lays .claude-plugin/types
npm run validate
npm test              # claude plugin test per plugin (148 tests)
```
Load all: `claude --plugin-dir mods/00-sdd-navigator --plugin-dir mods/01-phase-tracker …` (README has a one-liner). Needs a Spec-Kit project (`specify init --integration claude`).

## Architecture decisions that must not be silently reversed
- One Navigator (outer hook, embeds capability views); fallback = one pane at a time (`sdd-view`), auto-selected when a view fails to appear.
- `03` is the sole interceptor and approval entry; `06` sole Approve/Reject/Continue; `05` sole artifact/staleness owner; `07` sole ID graph; `02` sole template edit/save/reset; `10` aggregate/delegate only; `11` content only.
- `03` ≠ `04` (separate plugins; the plugin-origin submission bypasses the submitter's own hooks).
- Hotkeys are focus-scoped: `1–9`, `0`, `p` open views, `b` Back, `Esc` closes the whole pane. No global shortcuts.
- No invented quality score. Unknown/missing/unanswerable approval fails closed.
- `$.store` is per user: every record is project-keyed. Project data lives in `.speckit/mod/`.
- No `sdd-contracts` plugin; each owner declares its own noun.

## Verified runtime facts (Claude Code 2.1.289, Spec-Kit 1.1.0)
- Typed `/speckit-x` → `command.run` → `skill.prompt` → `prompt.submit`; model-invoked → `tool.call` `Skill`. `{text}`/`{drop}`/`{deny}` each stop it.
- `$.command.run` rejects inside an awaited hook; works from timers/later events; target sees `origin {kind:'plugin', name}`.
- Another plugin's `prompt.submit` hook sees plugin-origin submissions; the submitter's own are skipped.
- `Input` is single-line → `$.prompt.fill` is the edit path. `ui.close` hook refuses with `{deny}`.
- Validator: `$` only to same-file top-level functions; `$.state.get/set` need literal-const refs.
- Harness: inline plugins self-contained; host enforces state ownership; paths with `..` are normalized.

## Open items (need a decision or an interactive session)
**A. Spec wording that the code deliberately differs from (awaiting approval; smallest fixes):**
1. `04` §11: arming is on any plugin-origin `sdd-prompt-review` submission with header phase `analyze`, not only while `run=requested`.
2. `03` §10/11: Run is blocked by `BLOCKED` **or** `NOT_READY`.
3. `03` Edit: edited copy is captured into the existing pending review (marker `sdd-review-edit:<id>`), then Run; not a new review.
4. `03`: typed `/sdd-review run` requires a human origin (composer/bridge).
5. `02` §4: composed text rides in a session-only `composed` field of `promptResolution`; extra subcommands `resolve`, `seed`, `discard`.
6. `00` §13.7 / `10` §6: no `dependencies` in `plugin.json` (soft edges stay soft; types via workspace tsconfig).

**B. Not runtime-verified:** real-session plugin load order; Button `onPress` → `$.command.run`; person-origin Esc; interactive-TUI routing of `/speckit-*`; surfaces other than terminal.

**C. Functional gaps (caveats, not bugs):** `06` per-phase rules are constants (only analyze-before-implement, `approvalRequired`, `scoreFormula` configurable); `enabled:false` honoured only by `03` and `09`; no Mod reports config-section validation errors; Buttons not built: `05` Open artifact, `07` Review Gap/Open Source, `08` Mark exception (use `/sdd-converge except <scope> <reason>`), `09` Open item, `10` Review/Edit Prompt/Status; `05` artifact→phase map is a constant.

## Suggested next steps
1. Run an **interactive** session on a real Spec-Kit project with all plugins; check: `/sdd` pane, hotkeys, Esc vs `b`, hook order (does embedding work or does it auto-fall back), approving a `/speckit-plan` review end to end, an Analyze run with the read-only guard, Button-delegated commands.
2. Decide on the six spec wording changes in A (or tell me to change the code instead).
3. Optional hardening: configurable gate rules in `06`, per-Mod `enabled`, config-section validation reporting, the missing Buttons in C.
4. Initialise git (or copy the folder) before further edits; nothing is version-controlled.

## Gotchas for whoever continues
- Headless `claude -p` stream-json drivers: write the child's stdout to a file; plugin-queued commands make later outputs unreliable there, read the debug log (`--debug-file`) or the transcript instead.
- `claude plugin test` needed one headless `claude -p` run first to refresh the hooks rollout switch.
- A `.claude-plugin/types/` folder only appears after a plugin is loaded once from a folder; `npm run typecheck` fails until then.
- My e2e runs wrote plugin stores under `~/.claude/plugins/store/`; I deleted mine. Re-running e2e recreates them (project-keyed).
