# Spec — Spec-Kit SDD Quality Gate (capability Mod 06)

> **Plugin name:** `sdd-quality-gate` · **Navigator entry:** ⑥ (`6`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Evaluate whether an SDD phase is ready to proceed. `06` is the **sole owner of Approve, Reject and Continue**. It owns quality checks, blocking conditions, warnings, pass/fail state, and approval/continue decisions where applicable. It does **not** duplicate analysis logic owned by `04`.

## 2. Scope

**In scope:** configurable gates for Constitution, Specification, Clarification, Plan, Checklist, Tasks, Analyze, Implement, Converge (taken from the configured phase model); evidence-backed findings; optional approval gates; the gate view.
**Out of scope:** running analysis (`04`), prompt review (`03`), artifact inventory (`05`), ID graph (`07`), navigation (`00`).

## 3. Inputs

- `analyze` (`04`): consume the Analyze report when available; **do not rerun** expensive analysis.
- `artifacts` (`05`): required artifacts and freshness.
- `trace` (`07`): traceability gaps as evidence.
- `phase` (`01`): which phase each gate relates to.
- Gate policy from the `quality:` configuration section (required artifacts, validation rules, `analyze-required-before-implement`, `approval-required`, optional score formula).

## 4. Outputs

`quality` state; the gate view; decisions recorded as approval metadata.

## 5. State

Owned noun `quality` (plugin `sdd-quality-gate`, key `quality`):

```text
{
  gates,        // per phase: required artifacts, rules, status, timestamp, evidence
  blockers,
  warnings,
  approval      // per gate: none | approved | rejected, who/when (metadata)
}
```

Gate status (source of truth): `PASS`, `PASS_WITH_WARNINGS`, `BLOCKED`, `NOT_READY`, `NOT_APPLICABLE`. Display mapping for status lines: `PASS→READY`, `PASS_WITH_WARNINGS→WARNING`, `BLOCKED→BLOCKED`, `NOT_READY→NOT_READY`, `NOT_APPLICABLE→NOT_APPLICABLE`, no evidence → `UNKNOWN`.

**No invented scores.** Do not derive a numeric quality score from arbitrary heuristics. If a numeric score is used, its formula is explicit and configurable, and only then may it be published (and shown by `00`). Default behavior favors evidence-backed findings over a single opaque score. Stale evidence → `NOT_READY`.

`blockingFindings` (derived) = BLOCKER findings from `analyze` ∪ `quality.blockers`; it is not stored.

## 6. Contracts

- Owned: `quality` (`types/index.d.ts`, plugin `sdd-quality-gate`). Consumers: `03`, `08`, `10`. `09` observes.
- Consumed: `analyze` (04), `artifacts` (05), `trace` (07), `phase` (01), `capability` (own).
- `06` does **not** read `review` (cycle avoidance: `03 reads 06`).

## 7. Dependencies

- **Soft:** `04`, `05`, `07`, `01`, `00`. Missing evidence → `UNKNOWN`/`NOT_READY`, never an assumed pass.
- State edges: `06 reads 01, 04, 05, 07`; `03, 08, 10 read 06`. Acyclic.

## 8. UI

Contextual **gate view** (no permanent panel, no nav row): per-gate required artifacts, rule results, warnings, blockers, approval state, timestamp, evidence, with source links to `04`/`05`/`07` evidence.

- Buttons: **Approve**, **Reject**, **Continue**, **Review Findings**.
- Empty state: "No gate evaluated yet."
- Pointers (text) to ④ Analyze when Analyze evidence is missing/stale.

## 9. Commands

- `/sdd-quality` — text gate summary; `/sdd-quality approve|reject|continue <phase>` as explicit text equivalents of the Buttons (each requires confirmation).

## 10. Actions

| Action | Meaning |
|---|---|
| **Approve** | Records an explicit human approval for the gate's current evidence (metadata only). |
| **Reject** | Records an explicit rejection; the gate stays blocked. |
| **Continue** | Records the human decision to proceed to the next phase after a `PASS`/`PASS_WITH_WARNINGS`/approved gate. It does **not** run the next phase; the next phase still goes through `03`. |
| **Review Findings** | Read-only. |

Other Mods (`04`, `08`, `10`) may *request* an approval-related operation; `06` makes the decision. `10` only delegates.

## 11. Approval / Safety

- Approval must be explicit; a Button is never a bypass. Approval is bound to the evidence it was given for; if evidence goes stale the approval is invalidated.
- Cannot approve a `BLOCKED` gate without the blocker being resolved or an explicit, recorded exception path defined by configuration.
- Read-only toward artifacts. Does not rerun Analyze unnecessarily.

## 12. Persistence

`$.store`, **project-keyed**, bounded (gate results, approval metadata, timestamps, evidence ids/hashes; no full content). Session copy in `$.state`.

## 13. Failure / Unavailable Behavior

- Evidence source absent → that rule `UNKNOWN`; gate `NOT_READY` unless configuration marks the rule optional.
- Stale evidence → `NOT_READY`.
- Navigator absent → `/sdd-quality` text and confirmation flow.
- Publishes `capability = { id: "quality", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** gate state transitions; stale evidence; approval; rejection; continue; warnings; configuration changes; analyze integration without rerun; invalidation of approval on evidence change; no default numeric score.

**Acceptance:**
- [ ] Sole owner of Approve/Reject/Continue.
- [ ] No invented score; statuses shown by default.
- [ ] Consumes `04`, `05`, `07`; does not duplicate analysis.
- [ ] No state cycle (does not read `review`).

**Deliverables (later):** plugin, tests, configuration schema.
**Spikes:** A, B, F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Item | From → To | Reason |
|---|---|---|
| Approve/Reject/Continue | `04` Continue, `08` Continue, `10` actions → `06` | One approval-gate owner. |
| Reading `review` | Removed | Avoid `03 ↔ 06` cycle. |
| Score | Default removed | Evidence-based by default; formula must be explicit. |
