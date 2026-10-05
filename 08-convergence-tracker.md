# Spec — Spec-Kit SDD Convergence Tracker (capability Mod 08)

> **Plugin name:** `sdd-convergence-tracker` · **Navigator entry:** ⑧ (`8`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Track whether implementation has **converged** with the approved SDD artifacts. `08` owns convergence state, regression detection, cross-artifact consistency, open/blocking items, stale dependencies, review, **request re-analyze**, and **mark exception**. It **consumes** state from other capabilities rather than duplicating their logic.

Convergence is not "the code compiles". It requires evidence across: specification, plan, tasks, implementation, tests, validation/checks, analysis findings.

## 2. Scope

**In scope:** convergence states, evidence assessment, regression detection, exceptions, the convergence view.
**Out of scope:** running Analyze (`04`, via `03`), approval/continue decisions (`06`), artifact freshness (`05`), ID graph (`07`).

## 3. Inputs

- `artifacts` (`05`): freshness, implementation changes since analysis.
- `analyze` (`04`): findings and staleness.
- `quality` (`06`): gate status.
- `trace` (`07`): coverage and gaps.
- Host-exposed test/check results where available (failing tests/checks).
- Task completion evidence (task list state alone is never sufficient).

## 4. Outputs

`convergence` state; the convergence view; **requests** for re-analysis; recorded exception metadata.

## 5. State

Owned noun `convergence` (plugin `sdd-convergence-tracker`, key `convergence`):

```text
{
  state,           // NOT_STARTED | IN_PROGRESS | CONVERGING | CONVERGED | BLOCKED | REGRESSED
  regressions[],
  exceptions[]
}
```

Rules: track completed tasks; track implementation evidence; detect tasks that appear complete but lack evidence; detect implementation changes that invalidate previous analysis; detect newly introduced gaps; detect failing tests/checks when exposed by the host. **Never declare convergence solely from task checkboxes.** No evidence → never `CONVERGED`. Exceptions require explicit user approval and are recorded as metadata.

## 6. Contracts

- Owned: `convergence` (`types/index.d.ts`, plugin `sdd-convergence-tracker`). Consumers: `00`, `10`. `09` observes.
- Consumed: `artifacts` (05), `analyze` (04), `quality` (06), `trace` (07), `capability` (own).

## 7. Dependencies

- **Soft:** `05`, `04`, `06`, `07`, `00`.
- State edges: `08 reads 04, 05, 06, 07`; `00, 10 read 08`. Acyclic.
- Invocation edge: `08 → 03` (request re-analyze via the review path).

## 8. UI

Contextual **convergence view** (no permanent panel, no nav row):

requirements satisfied · tasks completed · tests passing · outstanding findings · stale analysis · regressions · convergence state.

Buttons: **Review**, **Request re-analyze**, **Mark exception**. (The original **Re-analyze** is replaced; **Continue** is owned by `06` and is not offered here.) Where it needs to point to `06`'s Continue, it shows a text pointer ("Gate decision: ⑥ Quality").

Empty state: "No convergence evidence yet" (state `NOT_STARTED`).

## 9. Commands

- `/sdd-converge` — text summary of convergence state, regressions, exceptions; opens ⑧ if Spike F permits.

## 10. Actions

| Action | Behavior |
|---|---|
| Review | Read-only detail of regressions/open items. |
| **Request re-analyze** | **Never runs Analyze directly.** Hands the request to the review/approval mechanism: `03` (`/sdd-run analyze`), where a human reviews and approves. Mechanism via `$.command.run` only if **Spike F** verifies; else the view shows the command for the user to run. `08` cannot bypass `03` or `06`. |
| Mark exception | Requires explicit user approval; recorded as metadata (what, why, when). Does not change any artifact or any gate decision. |

## 11. Approval / Safety

- Do not automatically modify SDD artifacts to make the project appear converged.
- Do not re-run or "request and assume" Analyze.
- Exceptions are explicit, recorded, and visible in `10` and `09`.

## 12. Persistence

`$.store`, **project-keyed**, bounded (state, regressions, exceptions metadata). Session copy in `$.state`. No full source/spec content.

## 13. Failure / Unavailable Behavior

- Missing evidence source → state not above `IN_PROGRESS`; never `CONVERGED` without evidence.
- Stale analysis → `CONVERGING` cannot advance; flag shown.
- Navigator absent → `/sdd-converge` text.
- Publishes `capability = { id: "converge", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** each state transition; checkbox-only completion does not converge; stale analysis blocks convergence; regression detection; failing checks; exception approval and recording; request re-analyze does not execute Analyze and routes through `03`; no artifact modified.

**Acceptance:**
- [ ] Consumes evidence, no duplicated logic.
- [ ] `Re-analyze` replaced by `Request re-analyze`.
- [ ] Keeps Review and Mark exception; Continue lives in `06`.
- [ ] Cannot bypass `03` or `06`.

**Deliverables (later):** plugin, tests.
**Spikes:** A, B, F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Item | From → To | Reason |
|---|---|---|
| "Re-run or request Analyze" (req 7) / **Re-analyze** | → *Request re-analyze* only | Analyze needs human approval via `03`. |
| **Continue** | → `06` | Sole owner. |
