<!-- sdd-pack: phase=checklist version=1 access=modifies-files -->
# SDD prompt layer — checklist

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Produce a quality checklist that validates requirement completeness, clarity and consistency.

## Access
May write checklist files only.

## Required inputs
Specification, plan, constitution.

## Expected outputs
Checklist items that test the *requirements* (is it specified, measurable, consistent?), each referencing the requirement ID it checks.

## Validation
No item tests implementation behavior; every item is answerable from the artifacts.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
