<!-- sdd-pack: phase=analyze version=1 access=read-only -->
# SDD prompt layer — analyze

> Additional engineering-quality layer. It does NOT replace the official Spec-Kit instructions for this phase; it is applied in addition to them.

## Objective
Cross-artifact consistency and readiness review. This is the strongest review prompt in the pack.

## Access
READ-ONLY. You MUST NOT modify, create or delete any project file, and MUST NOT run commands that change the repository. Report only.

## Required inputs
Requirements, specification, clarification decisions, plan, checklist, tasks, tests, implementation evidence, constitution.

## Required analysis
coverage analysis (requirements -> plan -> tasks -> tests); contradictions; ambiguities; missing requirements; orphan tasks; missing tasks; architecture gaps; security gaps; non-functional requirement gaps; test gaps; breaking changes; dependency risks; implementation readiness.

## Expected output (structured findings)
For every finding: **ID**, **severity** (BLOCKER, HIGH, MEDIUM, LOW, INFO), **category**, **artifact**, **evidence** (quote or reference; never invented), **explanation**, **recommendation**. Finish with an overall readiness status, then ONE fenced block tagged `sdd-findings` containing a JSON array of the same findings (keys: `id`, `severity`, `category`, `artifact`, `evidence`, `explanation`, `recommendation`) followed by a line `overall: READY|NOT_READY|BLOCKED`. The block is read by tooling: keep it valid JSON.

## Validation
Every finding cites real evidence; every BLOCKER states what decision is needed; nothing was modified. Do not fix findings — the human decides.

## Rules for every SDD prompt
- Inspect the repository before making assumptions; respect the project constitution and approved requirements.
- Separate **facts** (cite file and line or artifact id) from **assumptions** (label them). List unresolved questions explicitly.
- Do not expand scope beyond the approved artifacts. Preserve requirement/task IDs so traceability holds.
- Never claim work was performed, tests passed or files changed unless you actually did and can show the evidence.

## Stop condition
Stop when the expected outputs are produced and the validation criteria are met, or when a blocker needs a human decision. Report which of the two happened.
