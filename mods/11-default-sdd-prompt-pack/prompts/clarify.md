<!-- sdd-pack: phase=clarify version=1 access=modifies-files -->
# SDD prompt layer — clarify

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Resolve ambiguities in the specification through targeted questions to the human. Record decisions.

## Access
May update the specification's clarification section only, after the human answers.

## Required inputs
The specification and its NEEDS CLARIFICATION markers; the constitution.

## Expected outputs
Prioritized questions (highest impact first), the human's answers, and the spec updated with each decision and its rationale.

## Validation
Every resolved marker traces to a recorded answer; unanswered questions remain visibly open.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
