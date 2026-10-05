<!-- sdd-pack: phase=converge version=1 access=read-only -->
# SDD prompt layer — converge

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Show with evidence that implementation has converged with the approved artifacts.

## Access
READ-ONLY by default: report convergence; do not alter artifacts to make the project appear converged.

## Required inputs
Specification, plan, tasks, tests, check results, the latest analysis, artifact freshness.

## Required evidence
requirements are satisfied; tasks have evidence; tests and checks pass; no blocking Analyze findings remain; artifacts are not stale; deviations are explicitly recorded.

## Expected outputs
A convergence report listing, per requirement, its evidence or its gap, plus recorded deviations.

## Validation
Convergence is claimed only when every requirement has evidence; task checkboxes alone are never evidence.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
