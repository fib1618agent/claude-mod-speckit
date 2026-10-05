# Default SDD Prompt Pack (CONTENT ONLY)

Default, editable prompt templates for the Spec-Kit phases. This folder owns **content and metadata only**: no hooks, no state, no UI, no editing, no saving, no review, no approval.

It is an additional engineering-quality layer. It never replaces the official Spec-Kit prompts.

## How the prompt layers work

`02 Prompt Manager` composes, in this precedence order (nothing silently overwrites a higher layer, precedence is visible in the UI):

1. Spec-Kit / base phase instructions (upstream, read-only)
2. Organization / project engineering policy
3. **Project SDD prompt template** — copied from this pack into `.speckit/mod/prompts/` (only with your confirmation) and then yours to edit
4. Current repository context
5. Current feature artifacts
6. Your arguments
7. Optional one-time instructions

`03 Prompt Review Gate` shows the composed prompt and runs it only after you approve. Edits made there affect only that run unless you choose Save Template, which `02` performs.

## Files
- `pack.json` — pack id/version and, per template, phase, version and whether the phase is `read-only` or `modifies-files`.
- `prompts/<phase>.md` — the nine templates. `analyze` and `converge` are read-only.
