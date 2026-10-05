# SDD Mods — Spec-Kit capability Mods for Claude Code

One Navigator (`00`) and eleven capability folders (`01`–`11`). The architecture source of truth is the twelve specifications in the repository root (`../00-…md` … `../11-…md`).

| Folder | Plugin name | Role |
|---|---|---|
| `00-sdd-navigator` | `sdd-navigator` | UI shell: `/sdd`, nav row, view slot, Back/Close, the single status line |
| `01-phase-tracker` | `sdd-phase-tracker` | phase derived from the artifact inventory |
| `02-prompt-manager` | `sdd-prompt-manager` | templates, layer composition, `promptResolution`, template edit/save/reset, Pack catalog |
| `03-prompt-review-gate` | `sdd-prompt-review` | **sole interceptor** and human approval gate |
| `04-analyze-gate` | `sdd-analyze-gate` | Analyze findings and the best-effort read-only guard |
| `05-artifact-tracker` | `sdd-artifact-tracker` | canonical artifact inventory and staleness |
| `06-quality-gate` | `sdd-quality-gate` | gates; **sole** Approve / Reject / Continue |
| `07-traceability` | `sdd-traceability` | deterministic requirement-ID graph |
| `08-convergence-tracker` | `sdd-convergence-tracker` | evidence-based convergence, exceptions |
| `09-session-history` | `sdd-session-history` | bounded, project-keyed observer |
| `10-sdd-control-plane` | `sdd-control-plane` | derived aggregate view, `nextAction`, config view; delegates only |
| `11-default-sdd-prompt-pack` | `sdd-default-prompt-pack` | **content only**: nine templates + `pack.json` |

## Load

```bash
# from a Spec-Kit project (e.g. one created with `specify init --integration claude`)
claude $(for d in /path/to/mods/[01]*/; do printf -- '--plugin-dir %s ' "$d"; done)
```

Each Mod works alone through its text command (`/sdd-status`, `/sdd-prompt`, `/sdd-run <phase>`, `/sdd-review`, `/sdd-analyze`, `/sdd-artifacts`, `/sdd-quality`, `/sdd-trace`, `/sdd-converge`, `/sdd-history`). `/sdd` opens the Navigator.

## Develop

```bash
cd mods
npm install            # installs TypeScript locally (never global)
npm run sync           # copies _shared/*.ts into every plugin's hooks/shared/ (plugins cannot import across folders)
npm run sync:check     # fails on drift, and if the SddCapability contract type differs between plugins
npm run typecheck      # tsc -p per plugin (needs one load so the engine lays .claude-plugin/types)
npm run validate       # claude plugin validate per plugin
npm test               # claude plugin test per plugin
```

`.claude-plugin/types/` is written by the engine when a plugin is loaded from a folder; it is git-ignored.

## Rules the code follows

- Every state noun has one owner; its type lives in the owner's `types/index.d.ts`. Consumers read it; nobody copies it. (The tiny `SddCapability` type is declared per Mod because each Mod owns its own `capability`; `sync:check` keeps them identical.)
- Business-state reads are acyclic. The only two-way edge is `navigator.view` (capabilities read it while drawing; the Navigator reads phase/convergence/control for the status line).
- `$` is only passed to top-level function declarations of the same file (a validator rule), so IO sits in `register.tsx` and pure logic in `hooks/lib/`.
- Human approval is never implied: unknown, missing or unanswerable approval fails closed.
- `$.store` is per plugin and per user, not per project: every stored record is keyed by a project fingerprint. Project data lives under `.speckit/mod/`.

## Known limits

See the implementation report. In short: real-session plugin hook order, Button `onPress` → `$.command.run`, interactive-terminal routing and person-origin Esc are not runtime-verified.
