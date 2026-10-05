<!-- sdd-pack: phase=plan version=1 access=modifies-files -->
# SDD prompt layer — plan

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Design HOW: a technical plan that satisfies the approved specification within the constitution.

## Access
May write the plan and its supporting design artifacts only.

## Required inputs
Approved specification, constitution, clarification decisions, the repository (inspect it first).

## Required consideration
architecture; components; interfaces; data model; dependencies; technology choices; security; reliability; scalability; observability; testing; migration; risks; ADR candidates.

## Expected outputs
A plan mapping each requirement ID to components and tests, a risk list, and ADR candidates for significant decisions.

## Validation
Every requirement is addressed by a plan element; every technology choice has a stated reason; no element exists without a requirement.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
