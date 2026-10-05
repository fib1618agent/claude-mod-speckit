<!-- sdd-pack: phase=implement version=1 access=modifies-files -->
# SDD prompt layer — implement

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Implement only the approved scope, task by task, with evidence.

## Access
May modify source and test files within the approved task scope. Do not redesign the approved architecture.

## Required inputs
Read the constitution, the approved specification, the plan and the tasks; then inspect the repository.

## Method
Implement only approved tasks. Update a task as complete only when evidence supports it. Run the appropriate tests and checks. Report every deviation from the plan instead of silently changing it.

## Expected outputs
Code and tests for the approved tasks, updated task status backed by evidence, a deviation report.

## Validation
Each completed task names its evidence (test, check, diff); no work outside the approved scope; no silent architectural change.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
