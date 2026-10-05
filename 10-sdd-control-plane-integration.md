# Spec — Spec-Kit SDD Control Plane (capability Mod 10)

> **Plugin name:** `sdd-control-plane` · **Navigator entry:** ⑩ (`0`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

The **aggregated SDD operational view**. `10` is an aggregate / read / delegate layer. It is **not** a second Navigator, **not** an orchestration engine, and **not** an approval authority.

`10` owns: the aggregate view, the derived `nextAction`, the configuration view/editor, the event-flow documentation, and the acceptance fixture.

`10` does **not** own: phase interception (`03`), approval/rejection/continue (`06`), Analyze execution (`04`/`03`), prompt editing (`02`), artifact discovery (`05`), traceability (`07`), convergence decisions (`08`), or Navigator navigation (`00`).

## 2. Scope

**In scope:** showing Phase, Artifacts, Quality, Traceability, Analyze, Convergence and Next Action in one view; deriving `nextAction`; showing/editing configuration with validation delegated to owners; documenting the cross-Mod event flow; the end-to-end acceptance fixture.
**Out of scope:** doing any of the capabilities' work.

This is an orchestration/**governance** layer view, not a fork of Spec-Kit. Do not modify Spec-Kit source. Do not replace official Spec-Kit prompts silently. Preserve upstream semantics. Fail safely when a capability is unavailable.

## 3. Inputs

State of all capabilities (read-only): `capability`, `phase`, `promptResolution`, `review`, `analyze`, `artifacts`, `quality`, `trace`, `convergence`, `history`. Configuration file `.speckit/mod/config.yaml`.

## 4. Outputs

`control` state (summary + `nextAction`), the aggregate view, the configuration view.

## 5. State

Owned noun `control` (plugin `sdd-control-plane`, key `control`), session-scoped, **derived**:

```text
{
  summary,      // phase, artifact health, analyze, trace, quality (status words), convergence, last action
  nextAction    // derived recommendation; never executed by 10
}
```

`control` is added to the shared-state list by this amendment because the approved dependency edge `10 → 00` needs the Navigator status line to read an aggregate. It is derived from other nouns and holds no independent truth.

### nextAction derivation (pure function of other state)

Evaluated in order, first match wins, each result a *recommendation with an owner*: review `pending` → "Review the pending prompt (③)"; no/stale `analyze` before a phase that requires it → "Request Analyze via ③ (`/sdd-run analyze`)"; `quality` `BLOCKED`/`NOT_READY` → "Resolve blockers (⑥)"; trace gaps → "Review gaps (⑦)"; convergence `REGRESSED` → "Review regressions (⑧)"; otherwise → "Start the next phase `<phase.next>` through ③".

## 6. Contracts

- Owned: `control` (`types/index.d.ts`, plugin `sdd-control-plane`). Consumer: `00`. `09` observes.
- Consumed: every noun in §3 (read-only), owned by the Mods named in their specs. No declaration is copied; `10` lists owners under `dependencies` for types.

## 7. Dependencies

- **Soft** on every capability (a missing capability appears as `unavailable` in the view).
- State edges: `10 reads all`; `00 reads 10`. No Mod other than `00` reads `control`. Acyclic.
- Invocation edges outbound only (delegation).

## 8. UI

Contextual **aggregate view** (no permanent panel, **no top-level navigation row** — only `00` owns that):

```text
CURRENT PHASE        NEXT PHASE        PHASE PROGRESS
ARTIFACT HEALTH      ANALYZE STATUS    TRACEABILITY
QUALITY GATE         CONVERGENCE       LAST ACTION
NEXT ACTION
```

Statuses are words from the owners (never an invented score). Each field links, as text or a Button where Spike F permits, to its owner's view.

Also a **configuration view** (§9).

Actions listed in the original (Review Prompt, Edit Prompt, Run, Analyze, Review Findings, Approve, Reject, Status) are **delegates only**: each is a pointer/Button that hands off to the owner (`02`, `03`, `04`, `06`, `01`). `10` exposes only actions the host actually supports.

## 9. Configuration

Project-local `.speckit/mod/config.yaml` with **namespaced sections**, each read by its own Mod:

```text
phase | prompt | review | analyze | artifacts | quality | trace | convergence | history | control | navigator
```

Mapping of the original keys: enabled/disabled → every section's `enabled`; review-before-run → `review`; analyze-required-before-implement and approval-required and gate policies → `quality`; artifact tracking → `artifacts`; traceability → `trace`; history retention → `history`; UI preference → `navigator`/`control`; prompt directories → `prompt`. Exact YAML schemas are not hard-coded by this spec unless already specified; the `phase.model` section is shared read-only configuration (see `01` §6.3).

`10` provides the aggregate configuration view, the editing UI, and validation **delegation**: each Mod validates its own section and reports problems through its `capability` status (`degraded` with a `reason`). `10` does not become a runtime authority by showing configuration. Edits are written only after explicit confirmation and only under `.speckit/mod/`.

## 10. Commands

`/sdd-control` is **not** introduced (use `/sdd control` via `00`). Existing text fallbacks (`/sdd-status`, `/sdd-prompt`, `/sdd-artifacts`, `/sdd-quality`, ...) remain with their owners.

## 11. Event-Flow Table (replaces the 14-step pipeline)

The former pipeline is **documentation of a decentralized flow**, not an engine. Each Mod reacts to its own triggers and publishes its own state.

| # | Step | Triggering capability | Consumed state | Produced state | Delegated action | Approval |
|---|---|---|---|---|---|---|
| 1 | Detect phase request | `03` | phase model (config) | `review`=pending | — | none (interception) |
| 2 | Determine project/feature context | `05`, `01` | `artifacts` | `phase` | — | none |
| 3 | Load relevant prompt template | `02` | `11` content | `promptResolution` | — | none |
| 4 | Collect required artifacts | `05` → `02` | `artifacts` | (part of resolution) | — | none |
| 5 | Compose final prompt | `02` | layers | `promptResolution` | — | none |
| 6 | Present review gate (when enabled) | `03` | `promptResolution`, `quality` | `review` | — | human review |
| 7 | Execute only after explicit approval | `03` | `review` | `review`=approved | submit approved prompt | **explicit Run** |
| 8 | Observe result | `03`/host turn end | — | — | — | none |
| 9 | Update artifact state | `05` | file system | `artifacts` | — | none |
| 10 | Update phase tracker | `01` | `artifacts` | `phase` | — | none |
| 11 | Run configured quality gate | `06` | `analyze`, `artifacts`, `trace`, `phase` | `quality` | (Approve/Reject/Continue by human) | **explicit** for decisions |
| 12 | Update traceability | `07` | `artifacts` | `trace` | — | none |
| 13 | Update convergence | `08` | `artifacts`, `analyze`, `quality`, `trace` | `convergence` | request re-analyze → `03` | explicit via `03` |
| 14 | Record bounded history | `09` | all | `history` | — | none |

Steps 9–14 are triggered by the owning Mod's own observation (Spike B; fallback: re-derive at turn completion). Nothing in `10` triggers them.

## 12. Failure / Unavailable Behavior

- Any capability unavailable → its field shows `unavailable` (reason from `capability.reason`); `nextAction` skips rules that need it and says what is missing.
- `10` absent → every other Mod works; the Navigator omits the Gate segment of the status line and reads `phase`/`convergence` directly.
- Disabling `10` must not disable gating (gates live in `03`/`06`).
- Publishes `capability = { id: "control", version, status }`.

## 13. Approval / Safety

`10` cannot approve, reject, continue, run, analyze, intercept or edit prompts. Every action it shows is a delegate to the owner's gate. No human-gated action executes silently. Analyze remains read-only. Convergence is never claimed without evidence.

## 14. Acceptance / Implementation Readiness

### Acceptance fixture (partially completed Spec-Kit project)

Verify that:

1. The Mods detect the project (`05`/`01`).
2. Phase Tracker identifies the current phase.
3. `/speckit-plan` or equivalent (`/sdd-run plan`) resolves the Plan template (`02`, via `03`).
4. Prompt Review displays the composed prompt (`03`).
5. Editing changes only the execution copy unless Save Template is chosen (`03` → `02`).
6. Analyze is read-only (`04`; guard best-effort).
7. Analyze findings appear in the Quality Gate (`06`).
8. Traceability reports gaps (`07`).
9. Implementation does not proceed when a configured blocker exists (`03` reads `06`).
10. Convergence does not become `CONVERGED` without evidence (`08`).
11. History records the phase execution (`09`).
12. Disabling a Mod (`enabled: false` in its section) restores normal Spec-Kit behavior for that capability; disabling `03` restores unintercepted phase commands.
13. (New) The Control Plane view only aggregates and delegates: no action in `10` runs, approves or edits anything itself.

**Other tests:** `nextAction` derivation table; missing capability rendering; configuration edit requires confirmation and stays under `.speckit/mod/`; validation delegation shows `degraded` reasons.

**Acceptance:**
- [ ] Aggregate/read/delegate only; no orchestration engine.
- [ ] 14 steps documented as the event-flow table.
- [ ] No navigation row; no approval; no interception.
- [ ] Configuration view with namespaced sections; validation delegated.

**Deliverables (later):** plugin, shared-contract usage (types from owners), tests, configuration schema, README, installation and troubleshooting guides, architecture diagram in Markdown, the fixture repository.
**Spikes:** A, B, F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Removed / changed | To | Reason |
|---|---|---|
| Steps 1, 6, 7 (detect request, present review, execute after approval) | `03` | Sole interceptor/approval entry. |
| Steps 8–14 as orchestration | Each owning Mod, reactive | No second engine; documented as event flow. |
| Actions Approve / Reject | `06` | Sole owner. |
| Actions Review/Edit Prompt, Run, Analyze, Status | `02`, `03`, `04`, `01` | Delegation only. |
| Exclusive config ownership | Per-Mod namespaced sections; `10` shows/edits | Capability independence. |
| Added: `control` noun and `nextAction` | `10` | Needed for the `10 → 00` status-line edge. |
