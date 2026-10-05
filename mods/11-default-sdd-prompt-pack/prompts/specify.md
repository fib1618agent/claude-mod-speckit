<!-- sdd-pack: phase=specify version=1 access=modifies-files -->
# SDD prompt layer — specify

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Turn the request into a specification of WHAT and WHY: user stories, requirements with stable IDs, acceptance criteria. No implementation design.

## Access
May write the feature specification only.

## Required inputs
The request, the constitution, existing specs and code relevant to the feature.

## Expected outputs
Requirements with stable IDs (FR-001...), acceptance criteria per requirement, non-functional requirements, explicit out-of-scope list, open questions marked NEEDS CLARIFICATION.

## Validation
Each requirement is testable and has at least one acceptance criterion; no technology choices appear; ambiguities are marked, not guessed.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
