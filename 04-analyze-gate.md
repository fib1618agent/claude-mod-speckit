# Spec — Spec-Kit SDD Analyze Gate (capability Mod 04)

> **Plugin name:** `sdd-analyze-gate` · **Navigator entry:** ④ (`4`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, C, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Own the Spec-Kit `/speckit-analyze` phase's **semantic analysis**: inspect the current SDD artifacts and repository evidence, identify inconsistencies and gaps, and produce a reviewable analysis. This is the highest-priority quality input in the Mod family.

**Principle: Analyze is read-only.** It must not silently modify the specification, plan, tasks or source code.

`04` owns: analysis execution (as a delegated run), findings, coverage, read-only reporting, analysis result state, and the Findings view. It does **not** own approval, prompt editing, the traceability ID graph, or artifact inventory.

## 2. Scope

**In scope:** the analysis dimensions, structured findings, the Analyze view, Run / Re-run / Findings, read-only protection during a run.
**Out of scope:** Approve/Reject/Continue (`06`); prompt editing (`02`); review/approval of the run (`03`); ID-link graph and orphan/gap logic (`07`); artifact discovery/freshness (`05`).

## 3. Inputs

- Spec-Kit artifacts discovered by `05` (specification, plan, checklist, tasks, constitution, research/design artifacts, implementation state). Do not assume filenames when the installed Spec-Kit exposes another structure.
- `trace` from `07` as optional **evidence** for coverage/orphan dimensions (not re-derived here).
- `artifacts` from `05` for hashes and freshness.
- The analyze prompt resolved by `02`/reviewed by `03`.

## 4. Outputs

`analyze` state; a structured report; the Analyze view.

### Analysis dimensions (all required to be explicitly analyzed)

1 Requirement coverage · 2 Acceptance criteria coverage · 3 Ambiguity · 4 Contradictions · 5 Missing requirements · 6 Plan/spec consistency · 7 Task/spec consistency · 8 Orphan tasks · 9 Missing tasks · 10 Architecture consistency · 11 API/interface consistency · 12 Data model consistency · 13 Dependency risks · 14 Security risks · 15 Reliability/failure handling · 16 Observability · 17 Testing coverage · 18 Performance/NFR coverage · 19 Breaking-change risk · 20 Implementation readiness.

Dimensions 1, 2, 8, 9 prefer deterministic gaps from `07` when available and add semantic analysis on top.

### Report fields

overall status; severity; finding ID; category; source artifact; affected requirement/task; evidence; explanation; recommended action. Severities: **BLOCKER, HIGH, MEDIUM, LOW, INFO**. Do not invent evidence.

## 5. State

Owned noun `analyze` (plugin `sdd-analyze-gate`, key `analyze`):

```text
{
  at,
  countsBySeverity,
  findings,          // bounded
  artifactHashes     // hashes of the artifacts analyzed
}
```

Findings MUST be bounded (cap and truncation indicator defined at implementation; counts always complete). Staleness is derived: `artifactHashes` differ from the current `artifacts` hashes → the result is **stale** (no second staleness model).

Internal run-tracking (not shared): `run = idle | requested | running`.

## 6. Contracts

- Owned: `analyze` and the `AnalyzeResult` type (`types/index.d.ts`, plugin `sdd-analyze-gate`). Consumers: `06`, `08`, `10`. `09` observes.
- Consumed: `trace` (`07`, optional), `artifacts` (`05`), `capability` (own).
- Derived (not stored anywhere): `blockingFindings` = BLOCKER findings from `04` ∪ blockers from `06`.

## 7. Dependencies

- **Soft:** `07` (evidence), `05` (hashes/freshness), `03` (run delegation, invocation edge), `00`.
- State edges: `04 reads 07`, `04 reads 05`. `06`, `08`, `10` read `04`.
- The run request is an **invocation edge** to `03`; it is not a state read (this prevents a `03 → 06 → 04 → 03` cycle).

## 8. UI

Contextual **Analyze view** (no permanent dashboard, no nav row):

```text
SDD / ANALYZE

Specification & Design Analysis
Requirements, Acceptance Criteria, Plan Elements, Tasks, Tests (counts)
covered / uncovered / conflicts / ambiguities / orphan tasks / test gaps / security gaps
overall quality/readiness (status, not an invented score)

Findings   BLOCKER n  HIGH n  MEDIUM n  LOW n  INFO n
[Run Analyze] [View Findings]
```

- Staleness banner when the result is stale relative to `05`.
- Empty state: "No analysis yet."
- Wherever a prompt review/edit is relevant, the view shows a pointer text (for example "Prompt: ② · Review: ③") rather than owning those actions; a navigating Button only if Spike F is verified.

## 9. Commands

- `/sdd-analyze` — text fallback for the Analyze status/findings (opens ④ if Spike F permits). Running analysis is still `/sdd-run analyze` (owned by `03`).

## 10. Actions

| Action | Authority |
|---|---|
| **Run Analyze / Re-run** | `04` presents the action; execution is **delegated to `03`** (compose → review → approval → run). A Button here never executes directly. Mechanism: `$.command.run` of `/sdd-run analyze` if **Spike F** verifies; otherwise the view shows the command for the user to run. |
| **View Findings** | `04` (read-only). |

**Removed:** *Continue* (moved to `06`); *Edit Analyze Prompt* (moved to `02`).

## 11. Approval / Safety

### Read-only protection (best-effort)

While an Analyze run is active, deny mutating tool calls through the supported `tool.call` hook (`{ deny }`) for: **Write**, **Edit** (and notebook edits), and **mutating Bash operations**.

- **Best-effort, not an absolute security boundary.** Bash mutation detection is heuristic; the specification MUST label it so and tests must not claim otherwise.
- **Arming without a state cycle:** `04` arms the guard from its own `run = requested` plus the next plugin-origin prompt submission it observes at `prompt.submit` (the one `03` submits after approval); disarms at `turn.complete` (or when a user-origin prompt supersedes a never-approved request). `04` does not read `review`.
- **Runtime-verified (Spike G):** a `prompt.submit` hook in one plugin observes another plugin's `$.prompt.submit` with `origin.kind = "plugin"` and `origin.name = <submitting plugin>`. The submitting plugin's **own** hooks are skipped.
- **Mandatory architectural constraint: `03` Review Gate ≠ `04` Analyze.** They MUST remain separate plugins. If they were one plugin, the plugin-origin submission would bypass its own `prompt.submit` hooks and the guard could not arm from it. `04` never owns approval, prompt review or phase interception; it only observes the approved submission. Do not merge them.
- `04` arms only for a plugin-origin submission whose `origin.name` is the Review Gate's plugin name (`sdd-prompt-review`) while `run = requested`; any other origin never arms the guard.
- Do not "fix" findings automatically. The user decides whether to modify spec, plan, tasks or implementation (edits happen outside Analyze, under normal approval).
- Analyze requests never silently become Analyze execution (`08`/`10` only *request*).

## 12. Persistence

`analyze` is project-keyed `$.store` (the key MUST be derived from the project root, because `$.store` is per plugin and per user, **not** project-scoped). Metadata, counts and bounded findings only; no full source. Session copy in `$.state`.

## 13. Failure / Unavailable Behavior

- `07` absent → coverage dimensions are analyzed semantically only, with findings labeled *inferred*.
- `05` absent → staleness `UNKNOWN`; hashes cannot be compared.
- `03` absent → Run cannot be delegated; the view says "Review Gate unavailable"; no direct run.
- Guard cannot be installed → the run is refused (fail closed) with a reason.
- Navigator absent → `/sdd-analyze` text.
- Publishes `capability = { id: "analyze", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** fixtures with known conflicts verifying deterministic detection where possible; Analyze does not write files; guard denies Write/Edit/mutating Bash during a run and is disarmed after `turn.complete`; stale detection by hash change; bounded findings; run delegation requires approval; consumption of `07` gaps.

**Acceptance:**
- [ ] Analyze is read-only (best-effort enforcement labeled).
- [ ] All 20 dimensions covered; structured findings with the required fields.
- [ ] Continue and Edit Prompt removed; Run delegated through `03`.
- [ ] `AnalyzeResult` contract owned here, consumed by `06`/`08`/`10`.
- [ ] No state cycle introduced.

**Deliverables (later):** plugin, tests, fixtures.
**Spikes:** A, B, C (via `03`), F; plugin-origin visibility at `prompt.submit`.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Removed | To | Reason |
|---|---|---|
| Continue only after explicit approval | `06` | Sole approve/reject/continue owner. |
| Edit Analyze Prompt | `02` | Sole prompt-editing owner. |
| Direct execution | `03` | Approval boundary. |
| Requirement/orphan ID logic | `07` (consumed as evidence) | Deterministic ID graph has one owner. |
