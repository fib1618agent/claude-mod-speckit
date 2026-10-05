# Spec — Spec-Kit SDD Prompt Review Gate (capability Mod 03)

> **Plugin name:** `sdd-prompt-review` · **Navigator entry:** ③ (`3`) · **Readiness:** READY WITH CAVEATS (Spikes A, C, D, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

A real **human approval gate** before execution of Spec-Kit workflow phases. `03` is the **sole phase/prompt interceptor** in the SDD Mod family. It owns: interception, prompt resolution use, review state, approval entry, cancellation, run delegation, the approval fallback, generated-prompt presentation, review, edit (of the execution copy) and cancel.

## 2. Scope

**In scope:** intercepting a requested supported phase, presenting the composed prompt, Edit / Run / Cancel / Save Template, executing only after explicit approval, checking the target phase's quality gate before allowing Run.
**Out of scope:** template storage, persistent editing, reset (`02`); gate decisions Approve/Reject/Continue (`06`); analysis (`04`); navigation (`00`); aggregation (`10`).

Supported phases, at minimum: **constitution**, specify, clarify, plan, checklist, tasks, analyze, implement, converge — taken from the configured phase model (`01` §6.3), not hard-coded. Do not assume every phase is a Claude Code slash command: detect the actual Spec-Kit integration.

## 3. Inputs

1. A phase request arriving on any of the **interception paths** in §3.1, or the explicit `/sdd-run <phase>` command.
2. `promptResolution` from `02` (template, layers, hash).
3. `quality` from `06` (gate status for the target phase).
4. Repository/spec artifact context (via `02`, which uses `05`).
5. Review-mode configuration (`review:` section of `.speckit/mod/config.yaml`).

### 3.1 Interception paths (runtime-verified, Spec-Kit 1.1.0 + Claude Code 2.1.289)

`03` remains the **sole** Review/Interception owner. Observed routing for the Claude integration of Spec-Kit 1.1.0 (skills named `speckit-<phase>`, including `speckit-converge` and `speckit-taskstoissues`):

```text
typed /speckit-<phase> args  →  command.run  →  skill.prompt  →  prompt.submit (raw "/speckit-<phase> args")
model-invoked Skill          →  tool.call  (tool = "Skill", skill = "speckit-<phase>")
```

| Hook | What it can do (verified) | Use |
|---|---|---|
| `command.run` | Answer `{ text }` without `next`: the normal model call does not happen; the earliest point of a typed command. | **Preferred** interception point for typed Spec-Kit commands. |
| `skill.prompt` | Sees the expanded skill text. | Observed only; used to correlate, never to decide. |
| `prompt.submit` | Return `{ drop: reason }` for the raw text. | Backstop for typed text that reached the prompt without a `command.run` interception. |
| `tool.call` | Return `{ deny: reason }` for `tool = "Skill"`. | Interception of **model-invoked** Spec-Kit skills. |

Rules:

- **Do not assume every invocation uses every hook.** The implementation uses the **earliest reliable interception point for that execution path**.
- **All paths converge into one review state and one decision flow.** The hooks only *detect and divert*; they never carry approval logic. There is a single `requestReview(phase, args, path)` entry; a single `review` state; a single approval handler. No hook approves, caches an approval, or implements its own gate.
- Not tested, therefore not claimed: interactive-TUI routing, other Spec-Kit versions, non-Claude integrations, other phases' skill-name conventions. The recognized skill-name pattern is configuration-derived (the discovered phase set), not a hard-coded list.
- Detection is limited to the discovered Spec-Kit phase set; unrelated commands, skills and tools are never intercepted.

After approval, the reviewed execution is a plugin-origin submission (`$.prompt.submit`). Because the submitting plugin's own hooks are skipped, this re-entry never re-triggers `03`; other Mods' hooks (for example `04`'s guard) observe it with `origin {kind:'plugin', name:'sdd-prompt-review'}`.

## 4. Outputs

- `review` state (§5).
- A review card (contextual view).
- On approval only: the approved prompt submitted to the session (`$.prompt.submit`, origin = plugin).
- A `{ drop: reason }` for the original request when intercepted.

## 5. State

Owned noun `review` (plugin `sdd-prompt-review`, key `review`), session-scoped:

```text
{
  phase,
  promptHash,
  state            // pending | approved | cancelled
}
```

A bounded "last review" record is kept for the empty state (no full prompts stored).

## 6. Contracts

- Owned: `review`. Consumers: `09`, `10`. (`06` is **not** a consumer: see Changed Ownership.)
- Consumed: `promptResolution` (`02`), `quality` (`06`), `capability` (own).
- Execution contract: the run is delegated to the host by submitting the approved text as a plugin-origin prompt. The Mod MUST NOT modify project files as a side effect of previewing.

## 7. Dependencies

- **Hard:** `02` (a prompt to review).
- **Soft:** `06` (gate check; if absent the check is skipped and the review card says "no gate evidence"), `00`.
- State edges: `03 reads 02`, `03 reads 06`. Invocation edges inbound: `04`, `08`, `10` request runs through `03`.

## 8. UI

Contextual **review card** only (no permanent panel, no nav row):

- phase; source template (id/version/hash); prompt preview (bounded); layer/context summary; estimated size if available; target-phase gate status from `06`; read-only/may-modify indicator.
- Buttons: **Edit Prompt**, **Run** (primary), **Cancel**, optionally **Save Template**.
- Large prompts: bounded preview plus an explicit full-edit mechanism.
- **Empty state:** `No prompt pending` plus *Last review* (phase, time, outcome).
- If rich UI is unavailable: safe textual fallback (never pretend an editor exists).

## 9. Commands

- `/sdd-run <phase>` — explicit review-and-run entry (also the supported fallback if Spike C is negative).
- `/sdd-review` — text fallback for the review card/last review (and opens ③ if Spike F permits).

## 10. Actions

| Action | Behavior |
|---|---|
| Edit Prompt | Edits the **execution copy** only (per-run copy; owned here), using the editing mechanism defined in `02` §8. The terminal `Input` is single-line (verified), so the supported editing path is `$.prompt.fill` of the execution copy into the Claude composer; submitting the edited text is treated as a *new* review request (never an auto-run). Editing never runs the prompt. |
| Run | The only action that continues execution. Blocked when `06` reports the target phase gate `BLOCKED` (reason shown). |
| Cancel | Ends the review; nothing runs; `review.state = cancelled`. |
| Save Template | Requests a persistent save by `02` (explicit confirmation there). |

## 11. Approval / Safety

- **Interception:** when review mode is enabled, a supported phase request is not executed; the original request is answered with `{ drop: reason }` (a clear user-facing reason such as "Review required — use the review card or `/sdd-run plan`").
- **Only Run continues.** Never auto-run after editing; editing then Run still requires pressing Run; Edit then Cancel runs nothing.
- **Re-entry protection:** the Mod's own approved submission carries plugin origin and MUST pass straight through the interception without re-review. Nested or duplicate invocations while a review for the same phase is `pending` are rejected or coalesced with a message (no second pending review).
- **Plugin-origin protection:** prompts originating from other plugins/notifications are not intercepted unless they are a supported phase request; unrelated Claude Code commands are never intercepted.
- **Quality-gate check:** before enabling Run, read `quality`; `BLOCKED` blocks Run (for example a configured `analyze-required-before-implement` with a BLOCKER finding). `03` reads; `06` decides.
- **Approval fallback:** if the review card cannot be drawn, ask via `$.ui.ask` with explicit labels. If `$.ui.ask` rejects (for example `-p`, nobody to ask), **fail closed**: no approval, no run.
- Never modify project files while previewing. Never execute a destructive phase merely to preview it.
- Review mode disabled → normal Spec-Kit behavior is restored (no interception).

## 12. Persistence

`review` is session state. Last-review record is session (optionally a bounded, project-keyed `$.store` entry). No prompt text is persisted; `09` records hashes/ids only. Template persistence belongs to `02`.

## 13. Failure / Unavailable Behavior

- `02` absent or no template → cannot compose; request is **not** dropped silently — the original request is allowed through unreviewed only if review mode is off; with review mode on and no resolution, the request is dropped with an explicit reason (fail closed).
- `06` absent → Run allowed subject to approval; card states "no gate evidence".
- Malformed prompt → shown as an error; Run disabled.
- Missing phase → clear message, no execution.
- Unsupported UI → `$.ui.ask` / textual fallback.
- Navigator absent → `/sdd-run` and `/sdd-review` work.
- Publishes `capability = { id: "review", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** Run; Edit then Run; Edit then Cancel; Cancel; malformed prompt; missing phase; unsupported UI (`$.ui.ask`, `-p` fail-closed); nested invocation; duplicate invocation; review mode disabled; plugin-origin re-entry; gate `BLOCKED` blocks Run; Constitution phase handled; no file modified by preview.

**Acceptance:**
- [ ] `03` is the sole interceptor; no other Mod intercepts the same request.
- [ ] Only Run executes; approval cannot be bypassed by any Button elsewhere.
- [ ] Re-entry guard, plugin-origin protection, drop reason, gate check, `$.ui.ask` fallback, Constitution, Edit fallback all present.
- [ ] Empty state "No prompt pending" with last review.

**Deliverables (later):** plugin packaging, tests, README, configuration.

**Spikes (runtime results):** **C** resolved — `command.run` → `skill.prompt` → `prompt.submit`, and `tool.call` for model-invoked `Skill` (§3.1); `/sdd-run <phase>` remains the explicit entry. **D** resolved — single-line `Input`; `$.prompt.fill` is the editing fallback. **F** — `$.command.run` must not be called from the awaited `command.run` hook; prefer non-blocking actions (Button `onPress` unverified). A open.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Item | Detail | Reason |
|---|---|---|
| Sole interception | Removes interception from `10` | Two interceptors would double-prompt and let one bypass the other. |
| `06` reading `review` | Removed from the `review` consumer list | `03 reads 06` already exists; `06 reads 03` would create a state cycle (`03 → 06 → 03`). `06`'s gate decisions do not depend on review state. |
| Added | `quality` gate check, `/sdd-run`, Constitution | Approved amendment. |
| Template persistence | Stays with `02` | One persistence owner. |
