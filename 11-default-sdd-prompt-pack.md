# Spec — Default Spec-Kit SDD Prompt Pack (capability 11)

> **Kind:** `CONTENT ONLY` · **Working name:** `sdd-default-prompt-pack` · **Navigator entry:** ⑪ (`p`), rendered by `02` · **Readiness:** READY WITH CAVEATS (packaging, Spike D indirectly)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Provide the **default, editable prompt pack** consumed by `02`. This is an additional engineering-quality layer: it does **not** replace or overwrite the official GitHub Spec-Kit prompts.

`11` is **content only**. It owns: the default SDD prompt templates, prompt pack metadata, versions, and content. It owns **no UI**, no editing, no saving, no review, no approval and no navigation.

```text
11 -> content
02 -> catalog / editing UI / resolution
03 -> review and approval
```

## 2. Scope

**In scope:** nine templates, the principles every prompt follows, the per-phase content requirements, pack metadata, a README explaining the prompt layers.
**Out of scope:** any runtime behavior, UI, state, persistence logic, interception.

## 3. Inputs / 4. Outputs

Inputs: none at runtime. Outputs: files and metadata consumed by `02`.

Templates (project-local after seeding by `02`, under `.speckit/mod/prompts/`):

`constitution.md`, `specify.md`, `clarify.md`, `plan.md`, `checklist.md`, `tasks.md`, `analyze.md`, `implement.md`, `converge.md`.

Phase coverage follows the configured phase model; templates for phases not in the discovered Spec-Kit set are simply unused.

## 5. State

None. `11` declares no state noun and publishes no `capability` state of its own; its availability is observed by `02` (content present/absent).

## 6. Contracts

- **Pack metadata** (consumed by `02`): pack id, pack version, and per template: phase, template id, template version, and whether the phase is **read-only** or **may modify files** (principle 9). `02` owns the definition of how that metadata is read; `11` supplies it. No type contract is owned by `11` because it owns no state noun.

## 7. Dependencies

- None outward. **`02 → 11` is a hard dependency** (see `02` §7). `11` does not depend on any Mod.

## 8. UI

**None.** Content is surfaced through `02` (catalog and detail views) and `03` (review). Navigator entry ⑪ resolves to `02`'s read-only Prompt Pack catalog. `11` must not define a viewer, panel, button or shortcut.

## 9. Commands / 10. Actions

None.

## 11. Approval / Safety

- Do not replace or overwrite official Spec-Kit prompts; do not claim pack text is official Spec-Kit text.
- The user must be able to edit every prompt before execution (via `02` for templates; via `03` for the per-run execution copy).
- Seeding the pack into a project and any overwrite is performed by `02` with explicit confirmation; `11` never writes anything.
- Every template states whether the phase is read-only or may modify files, and **Analyze MUST NOT modify project files**.

## 12. Persistence

None by `11`. Delivery format (a plugin asset folder or a repository folder) is a packaging decision recorded as a caveat: it must be readable by `02` through supported means, and project copies live under `.speckit/mod/prompts/`.

## 13. Failure / Unavailable Behavior

Pack missing → `02` disables Restore/Seed and phases with no project template are blocked runs; nothing else is affected.

## 14. Content Requirements (preserved from the original)

### Prompt design principles — every prompt must

1. State its phase objective.
2. Identify required input artifacts.
3. Inspect the repository before making assumptions.
4. Respect the project constitution and approved requirements.
5. Clearly distinguish facts from assumptions.
6. Identify unresolved questions.
7. Avoid scope creep.
8. Preserve traceability.
9. State whether the phase is read-only or may modify files.
10. Define expected outputs.
11. Include validation criteria.
12. Include a stop condition.
13. Never claim work was performed when it was not.

### Plan prompt

Require detailed consideration of: architecture; components; interfaces; data model; dependencies; technology choices; security; reliability; scalability; observability; testing; migration; risks; ADR candidates.

### Analyze prompt (the strongest review prompt)

Require cross-artifact analysis of: requirements; specification; clarification decisions; plan; checklist; tasks; tests; implementation evidence.

Require: coverage analysis; contradictions; ambiguities; missing requirements; orphan tasks; missing tasks; architecture gaps; security gaps; NFR gaps; test gaps; breaking changes; dependency risks; implementation readiness.

Output structured findings with: ID, severity, category, artifact, evidence, explanation, recommendation. **Analyze MUST NOT modify project files.** (Severity vocabulary matches `04`: BLOCKER, HIGH, MEDIUM, LOW, INFO.)

### Implement prompt

Require: read constitution; read approved spec; read plan; read tasks; inspect repository; implement only approved scope; update tasks only when evidence supports completion; run appropriate tests/checks; report deviations; do not silently redesign approved architecture.

### Converge prompt

Require evidence that: requirements are satisfied; tasks have evidence; tests/checks pass; no blocking Analyze findings remain; artifacts are not stale; deviations are explicitly recorded.

### Deliverables (later)

All nine template files plus a README explaining how the prompt layers work (including the precedence list in `02` §3).

## 15. Acceptance / Implementation Readiness

- [ ] Declared CONTENT ONLY; no UI, no state, no commands.
- [ ] All nine templates meet the thirteen principles.
- [ ] Analyze and Implement and Converge content requirements present.
- [ ] Surfaced only via `02` → `03`.
- [ ] Official Spec-Kit prompts untouched.

**Spikes:** none of its own (packaging format is a caveat).
**Readiness:** READY WITH CAVEATS (packaging decision).

### Changed Ownership / Removed Responsibility

| Removed / changed | To | Reason |
|---|---|---|
| Any independent UI or viewer | `02` (catalog) | Content-only. |
| "The user must be able to edit every prompt" mechanism | `02` (templates) and `03` (execution copy) | Editing has one mechanism, defined in `02`. |
| Navigator ownership | none (⑪ via `02`) | Prompt Pack owns no UI. |
