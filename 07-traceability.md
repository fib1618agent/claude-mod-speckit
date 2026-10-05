# Spec — Spec-Kit SDD Requirement Traceability (capability Mod 07)

> **Plugin name:** `sdd-traceability` · **Navigator entry:** ⑦ (`7`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Establish **bidirectional, deterministic traceability** between requirements, specifications, plans, tasks, tests and implementation evidence. `07` is the sole owner of deterministic requirement IDs, the ID-link graph, the traceability matrix, gaps, orphan tasks and source links. Its UI is contextual/on demand — never a permanent dashboard.

## 2. Scope

**In scope:** ID extraction, link graph, forward/reverse traces, gap detection, matrix and summary.
**Out of scope:** semantic analysis (`04` — may consume `trace` gaps as evidence), artifact discovery (`05`), prompt editing (`02`), gate decisions (`06`), navigation (`00`).

## 3. Inputs

- Artifact locations and freshness from `05` (soft; without it `07` cannot locate sources and reports unavailable).
- Source documents and code/test files read through the supported filesystem API, **IDs and bounded metadata only**.
- The `trace:` configuration section (ID patterns, test/implementation locations).

## 4. Outputs

`trace` state; the traceability matrix view; gap list.

### Trace model

```text
Requirement
  -> User Story
  -> Acceptance Criteria
  -> Plan Element
  -> Task
  -> Test
  -> Implementation Evidence
```

Reverse: `Implementation -> Task -> Requirement`.

### Rules

1. Extract identifiers where the project uses explicit IDs.
2. Prefer deterministic references over semantic guesses.
3. When semantic inference is used, label it **inferred**.
4. Never claim traceability solely because two documents mention similar words.
5. Detect: uncovered requirements; orphan tasks; tasks without requirements; tests without requirements; requirements without acceptance criteria; implementation with no mapped task.
6. Provide a matrix and summary.

If deterministic ID extraction does not require a prompt template, none is invented (see Changed Ownership).

## 5. State

Owned noun `trace` (plugin `sdd-traceability`, key `trace`), session-scoped:

```text
{
  counts,
  gaps[]
}
```

`counts` summarize requirements/links per layer; `gaps[]` is bounded, each entry carrying kind, id(s), source reference and an `inferred` flag. The full link graph is internal and recomputable (not shared).

## 6. Contracts

- Owned: `trace` (`types/index.d.ts`, plugin `sdd-traceability`). Consumers: `04`, `06`, `08`, `10`. `09` observes.
- Consumed: `artifacts` (`05`), `capability` (own).

## 7. Dependencies

- **Soft:** `05`, `00`.
- State edges: `07 reads 05`; `04, 06, 08, 10 read 07`. Acyclic (`07` does not read `04`).

## 8. UI

Contextual **matrix** (no permanent dashboard):

```text
Requirement | Plan | Tasks | Tests | Implementation | Status
```

Actions: **Review Gap**, **Open Source**, **Re-run / request** (re-extract; read-only). Inferred links are visibly labeled. Empty state: "No requirement IDs found" (reported as `NOT_APPLICABLE` for consumers).

## 9. Commands

- `/sdd-trace` — text summary and gap list (opens ⑦ when the Navigator is present and Spike F permits).

## 10. Actions

| Action | Authority |
|---|---|
| Review Gap | `07` read-only detail of one gap. |
| Open Source | Read-only; no verified open-in-editor API, so show the path (see `05` §8). |
| Re-run | Re-extracts IDs and relinks; read-only. |

No action edits artifacts or prompts. **Removed:** *Edit Traceability Prompt*.

## 11. Approval / Safety

Read-only. Never writes artifacts. Does not approve, reject, continue or run anything. Never presents an inferred link as deterministic.

## 12. Persistence

Bounded metadata and IDs only; **do not persist complete source content**. Session state; recomputed from files. Any cache is project-keyed (never an unkeyed `$.store`).

## 13. Failure / Unavailable Behavior

- No explicit IDs → `trace` reports `NOT_APPLICABLE` counts (consumers treat as such).
- `05` absent → capability `degraded`; the view says sources cannot be located.
- Changed IDs → previous links reported as broken, not silently re-mapped.
- Navigator absent → `/sdd-trace` text.
- Publishes `capability = { id: "trace", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** fixtures for perfect coverage; missing mappings; orphan tasks; ambiguous semantic matches (labeled inferred); changed IDs; tests without requirements; implementation with no task; no persistence of full content.

**Acceptance:**
- [ ] Sole owner of the deterministic ID graph, links and gap/orphan logic.
- [ ] No prompt editing, no Edit Traceability Prompt.
- [ ] Contextual UI only.
- [ ] Inferred relationships always labeled.

**Deliverables (later):** plugin, tests, fixtures.
**Spikes:** A, B, F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Removed / changed | Detail | Reason |
|---|---|---|
| Edit Traceability Prompt | Removed | Prompt editing belongs to `02`; ID extraction is deterministic and needs no template (none invented). |
| Coverage/orphan logic duplicated in `04` | `07` owns deterministic version; `04` consumes `trace` as evidence | Single owner. |
| Reads `05` | Added | Needs artifact locations. |
