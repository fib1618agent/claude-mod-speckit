# Spec — Spec-Kit SDD Session History (capability Mod 09)

> **Plugin name:** `sdd-session-history` · **Navigator entry:** ⑨ (`9`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Track the evolution of an SDD workflow without storing sensitive project content unnecessarily. `09` owns SDD **action history**: phase executions and transitions, analysis runs, approvals, artifact changes relevant to SDD, and convergence transitions. It is primarily an **observer** and primarily on-demand.

## 2. Scope

**In scope:** bounded history records, commands, the timeline view, prompt reproducibility metadata, privacy settings.
**Out of scope:** acting on anything it records; deciding phase/gates/convergence.

## 3. Inputs

Observation of other Mods' state nouns: `phase` (01), `promptResolution` (02), `review` (03), `analyze` (04), `artifacts` (05), `quality` (06), `trace` (07), `convergence` (08), plus `capability`. Observation mechanism:

- **`state.set` observation** (hook on the owner's plugin/key, pass-through) **where verified**;
- otherwise **re-derive at turn completion** by diffing current state against the last recorded snapshot.

Post-write hook ordering is not assumed (**Spike B**).

## 4. Outputs

`history` state; the timeline view; history commands.

### Record (bounded metadata per phase execution)

phase; timestamp; session identifier if exposed; prompt template identifier/hash; prompt version; user-override indicator; execution status; gate decision; artifacts affected; analysis summary; convergence state.

**Do not persist** secrets, credentials, full source files, or entire prompts unless explicitly enabled by the user.

### Prompt reproducibility

It must be possible to determine which prompt template/version was used (id, version, hash from `promptResolution`) without storing the whole prompt.

## 5. State

Owned noun `history` (plugin `sdd-session-history`, key `history`): **bounded entries** (count and size caps; oldest evicted).

`lastAction` is **derived** from the tail of `history` and is never separate state.

## 6. Contracts

- Owned: `history` (`types/index.d.ts`, plugin `sdd-session-history`). Consumers: `00`, `10`.
- Consumed (read/observe only): all nouns listed in §3. `09` never writes any of them.

## 7. Dependencies

- **Soft** on every observed Mod; a missing Mod simply produces no entries.
- State edges: `09 reads all`; only `00` and `10` read `09`. Acyclic because `09` observes neither `navigator.view` (`00`) nor `control` (`10`), the only two nouns' owners that read `history`, and no other Mod reads `history`.

## 8. UI

Contextual, **on demand** timeline (no permanent panel):

```text
time -> phase -> prompt version -> result -> gate -> next step
```

Actions: **Open item** — open the relevant artifact or result through supported mechanisms (no verified open-in-editor API; show the path/reference, see `05` §8), **Clear**. Empty state: "No SDD history yet."

## 9. Commands

- `/sdd-history`
- `/sdd-history phase <phase>`
- `/sdd-history last`
- `/sdd-history clear` — clears the appropriate (current project's) history, after explicit confirmation.

## 10. Actions

Open item (read-only); Clear (destructive, confirmed). 09 takes no other action.

## 11. Approval / Safety

- Observer only; cannot approve, reject, continue, run, edit.
- Clear requires confirmation and affects only this project's history.
- Privacy settings: full prompt storage off by default; redaction of secrets before any write.

## 12. Persistence

Bounded, **project-keyed `$.store`** (the store is per plugin and per user and is not project-scoped, so the key derives from the project root). Retention follows the `history:` configuration section. Session identifiers kept only if the host exposes them, and sessions are kept separate.

## 13. Failure / Unavailable Behavior

- Observation unavailable (Spike B negative) → re-derive at `turn.complete`; entries may be coarser but are never fabricated.
- Missing metadata → fields recorded as absent, not guessed.
- Store full/over cap → evict oldest, never crash.
- Navigator absent → `/sdd-history` text.
- Publishes `capability = { id: "history", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** bounded storage and eviction; cleanup (`clear`); session separation; two-project isolation; missing metadata; privacy settings (no prompts/secrets persisted); observation path and re-derive path both produce the same entries; `last` and `phase` queries.

**Acceptance:**
- [ ] Observer role; no writes to others' state.
- [ ] Bounded, project-keyed persistence; no incorrect claim that `$.store` is project-scoped.
- [ ] Reproducibility without storing prompts.
- [ ] On-demand UI only.

**Deliverables (later):** plugin, tests.
**Spikes:** A, B, F.
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Item | Detail | Reason |
|---|---|---|
| Observation model | Explicit `state.set` observation + re-derive fallback | Hook ordering unverified. |
| Persistence | Project-keyed store with caps | `$.store` is not project-scoped. |
| `lastAction` | Derived from `history` | No competing state. |
