<!-- sdd-pack: phase=constitution version=1 access=modifies-files -->
# SDD prompt layer — constitution

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Establish or amend the project constitution: the non-negotiable engineering principles later phases must respect.

## Access
May modify only the constitution file. Make no other change.

## Required inputs
Existing constitution (if any), repository layout, existing conventions (build, test, lint, security, review).

## Expected outputs
A constitution of testable principles, each with a rationale and how compliance is checked. Amendments list what changed and why.

## Validation
Every principle is specific and verifiable; no principle contradicts another or the repository's existing tooling.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
