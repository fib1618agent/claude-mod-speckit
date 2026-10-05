# Spec — Spec-Kit SDD Prompt Manager (capability Mod 02)

> **Plugin name:** `sdd-prompt-manager` · **Navigator entry:** ② (`2`) and ⑪ (`p`, Prompt Pack catalog) · **Readiness:** READY WITH CAVEATS (Spikes A, D)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Manage editable prompt templates for GitHub Spec-Kit phases. The user should never have to hand-construct a detailed prompt for each Spec-Kit phase: the Mod loads a phase-specific template, combines it with project context and exposes the **resolved prompt** (`promptResolution`) for review in `03`.

`02` owns: prompt templates, versions, composition, project-specific prompt configuration, prompt inspection/editing/save/reset, and the **Prompt Pack catalog** view (⑪). It does **not** own the global SDD navigation row, review/approval (`03`), or Prompt Pack content (`11`).

## 2. Scope

**In scope:** layer composition, template storage, load, show, edit (template-level), save as project template, restore default, version/hash tracking, catalog of the Prompt Pack, precedence visibility.
**Out of scope:** intercepting phase requests, the review card, approval, execution (`03`); default template content (`11`); navigation (`00`).

## 3. Inputs

Deterministic prompt composition pipeline (precedence visible, nothing silently overwritten):

1. Spec-Kit/base phase instructions (upstream, read-only)
2. Organization/project engineering policy
3. Project-specific SDD prompt template
4. Current repository context
5. Current feature artifacts (via `05`'s inventory when available)
6. User-provided arguments
7. Optional one-time instructions

Template sources: project-local `.speckit/mod/prompts/` with `constitution.md`, `specify.md`, `clarify.md`, `plan.md`, `checklist.md`, `tasks.md`, `analyze.md`, `implement.md`, `converge.md`; defaults from the Prompt Pack `11`. If the current Spec-Kit layout differs, inspect it and adapt without modifying upstream files. Phase commands/skills are detected from the actual installed environment, not assumed.

## 4. Outputs

- `promptResolution` state (§5).
- The composed prompt text, handed to `03` for review (the text itself is not persisted as state).
- Contextual views (§8): phase prompt detail and Prompt Pack catalog.

## 5. State

Owned noun `promptResolution` (plugin `sdd-prompt-manager`, key `promptResolution`):

```text
{
  phase,
  templateId,
  version,
  hash,
  layers[],
  composed?   // session-only, bounded: the composed text handed to `03`; never written to disk or `$.store`
}
```

`layers[]` records, in precedence order, each layer's source (`upstream | policy | project-template | context | artifacts | arguments | one-time`) and its identifier/hash — enough to distinguish **upstream Spec-Kit instructions**, **project prompt** and **user override** (original requirement 11) without storing whole prompts. Template version/hash tracking is original requirement 7.

## 6. Contracts

- Owned: `promptResolution` (`types/index.d.ts` under `sdd-prompt-manager`). Consumers: `03`, `09` (and `10` observes).
- Consumed: `11` content (files, not state); optionally `artifacts` (`05`) for the feature-artifact layer; `capability` (own publication).
- Template metadata contract (shared with `11`, owned by `02` as the consumer-side definition): a template declares its phase, version and whether the phase is **read-only or may modify files** (needed by `04`'s guard and shown in `03`'s review).

## 7. Dependencies

- **Hard:** `11` (default templates). Without `11`, "Restore default" and seeding are unavailable and a phase lacking any template is a **blocked run** (`missing template = blocked run`); project-local templates still work.
- **Soft:** `05` (artifact layer), `00`.
- State edges: none required (`02` reads files and optionally `05`).

## 8. UI

Contextual views, no permanent panel, no navigation row:

- **② Prompt detail** — per phase: layers in precedence with source labels, template id/version/hash, scope (project/global), validity.
- **⑪ Prompt Pack catalog** — read-only list of the Prompt Pack's templates and versions rendered from `11`'s content, with "seed to project" available as an explicit action (§10). This is the target of Navigator entry ⑪. `11` has no UI.
- Empty state: no templates found; Pack unavailable (reason shown).

**Editing mechanism (single definition, referenced by `03`):** the terminal `Input` is **single-line** (runtime-verified, Spike D); no multiline Input API is assumed or invented. The **supported prompt-editing fallback is `$.prompt.fill(...)`** of the text into the Claude composer; the user edits there and submitting is the user's own action — never auto-executed. Persistent **template** editing/saving stays owned by `02` (a filled composer text is only saved through an explicit Save action); per-run execution-copy editing is owned by `03`, which uses this same mechanism. A short single-line value (for example a title or one-time instruction) may use `Input`.

## 9. Commands

- `/sdd-prompt` — overview (opens ② via the Navigator if Spike F permits; else text).
- `/sdd-prompt show <phase>`
- `/sdd-prompt edit <phase>`
- `/sdd-prompt reset <phase>`
- `/sdd-prompt save <phase>`
- `/sdd-prompt seed` — seed the Pack templates (see §10).
- `/sdd-prompt discard` — discard unsaved edit drafts.
- `/sdd-prompt resolve <requestId> <phase> [args]` — internal contract used by `03`; not a user-facing command.

## 10. Actions

| Action | Notes |
|---|---|
| Show | Read-only; no file written. |
| Edit | Produces a **user override** only; the base/project template is not modified unless Save is chosen. |
| Save as project template | Writes under `.speckit/mod/prompts/` after explicit confirmation. |
| Restore default | Replaces the project template with the Pack default after explicit confirmation. |
| Seed from Pack | First-use copy of Pack templates into `.speckit/mod/prompts/`, explicit confirmation, never overwriting an existing file silently. |

## 11. Approval / Safety

- Never claim a prompt is official Spec-Kit text unless it is; labels distinguish upstream / project / override.
- **Never execute** an edited prompt without explicit user approval — execution and the approval gate belong to `03`; `02` never runs a prompt.
- File writes (Save, Restore, Seed) require an explicit in-UI confirmation and are restricted to `.speckit/mod/` (resolve real paths and allow-list under the project root; a deny-list of spellings is not sufficient).
- Do not silently overwrite higher-priority instructions; precedence is visible.
- Load templates safely; malformed templates are reported, not executed.

## 12. Persistence

Project data lives in files under `.speckit/mod/` (prompts and the `prompt:` section of `.speckit/mod/config.yaml`). `promptResolution` is recomputed per request (session). Scope: project and global templates are distinguished; global is user-level and must be labeled so. No project data in unkeyed `$.store`.

## 13. Failure / Unavailable Behavior

- Missing template → blocked run with reason (visible in `03`).
- Malformed template → error with location; not used.
- `11` absent → Restore/Seed disabled; project templates still resolve.
- Navigator absent → `/sdd-prompt ...` text commands remain fully functional.
- Publishes `capability = { id: "prompt", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** precedence; missing templates; malformed templates; edits; reset; save; project/global scope; cancellation; Pack catalog; seed without overwrite; path-escape attempts rejected.

**Acceptance:**
- [ ] Deterministic composition with visible precedence.
- [ ] `promptResolution` owned here and consumed by `03`/`09` without redeclaration.
- [ ] ⑪ resolves to the read-only Pack catalog rendered by `02`.
- [ ] `02` is the only owner of template edit/save/reset.
- [ ] No execution of prompts; no writes without confirmation; no writes outside `.speckit/mod/`.

**Deliverables (later):** plugin packaging, tests, README, examples.

**Spikes:** A, D (multiline Input), F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Changed | Detail | Reason |
|---|---|---|
| Added: ⑪ catalog | Was ambiguous between `11` and `02` | `11` content-only. |
| Original req 8/9 ("show composed prompt before execution", "never execute without approval") | Presentation and approval moved to `03` | `03` is sole interceptor and approval entry. `02` supplies the resolution. |
| Per-run edit | The review-time **execution copy** is owned by `03` using this spec's editing mechanism; persistent template edit/save/reset stays here | One mechanism, one persistence owner. |
