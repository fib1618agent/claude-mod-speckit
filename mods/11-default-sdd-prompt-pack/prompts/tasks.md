<!-- sdd-pack: phase=tasks version=1 access=modifies-files -->
# SDD prompt layer — tasks

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Break the plan into ordered, independently verifiable tasks that preserve requirement traceability.

## Access
May write the task list only.

## Required inputs
Specification, plan, checklist, constitution.

## Expected outputs
Ordered tasks with IDs, each referencing the requirement ID(s) it satisfies, its dependencies and the test or check that proves it done.

## Validation
No orphan task (every task maps to a requirement); every requirement is covered by at least one task; dependencies form no cycle.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
