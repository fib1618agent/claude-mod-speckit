# Spec — Spec-Kit SDD Phase Tracker (capability Mod 01)

> **Plugin name:** `sdd-phase-tracker` · **Navigator entry:** ① (`1`) · **Readiness:** READY WITH CAVEATS (Spikes A, B, F)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only; nothing is implemented. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

Track where a GitHub Spec-Kit Spec-Driven Development workflow stands, **derived from observable artifact evidence** rather than from which command was last typed. Owns phase determination, phase progress, phase transitions and artifact-derived phase state.

It does not own the Navigator, a permanent panel, or artifact discovery.

## 2. Scope

**In scope:** current/next phase, completed/pending/blocked/failed phases, relevant artifact names, last update, manual refresh, textual status.
**Out of scope:** artifact discovery and freshness (`05`), navigation and status line (`00`), prompt/review/approval (`02`/`03`/`06`).

Target lifecycle is discovered, not hard-coded: `constitution -> specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> converge` as the default phase model (see §6.3).

Ground truth: before implementation, inspect the installed Claude Code Mod API and the current Spec-Kit repository/templates. Do not invent hook names, UI APIs, events or artifact paths.

## 3. Inputs

1. `artifacts` from `05` (the **only** source of artifact evidence).
2. The phase model from configuration (`phase:` section of `.speckit/mod/config.yaml`; §6.3).
3. Repository detection: whether the current repository is a Spec-Kit project, and the active feature/spec directory, **as reported by `05`'s inventory** (01 does not walk the filesystem itself).
4. Successful workflow execution signals where exposed by the host (for example a completed turn), used only to corroborate artifact evidence.

Never mark a phase complete merely because a slash command was typed.

## 4. Outputs

- `phase` state (§5).
- Contextual Phase view (§8).
- Textual status (§9).

## 5. State

Owned noun `phase` (plugin `sdd-phase-tracker`, key `phase`), session-scoped:

```text
{
  current,
  next,
  phases[ { id, status, evidence } ],
  at
}
```

`status` per phase: `complete | current | pending | blocked | failed | unknown`. `evidence` lists artifact ids/hashes from `05` that justify the status. Bounded and session/project scoped (original requirement 11). Phase state is recomputed from `artifacts`; it is not authoritative history (history is `09`).

## 6. Contracts

### 6.1 Owned contract

`types/index.d.ts` declares `phase` under plugin `sdd-phase-tracker`. Consumers (`00`, `06`, `10`) reference it; nobody copies the declaration. `09` observes it.

### 6.2 Consumed contracts

`artifacts` (owner `05`); `capability` (own publication: `{ id: "phase", version, status }`).

### 6.3 Phase model

The phase model (ids, order, the artifacts each phase produces/requires) is configuration, defined semantically by `01` and read by every Mod from the same `phase:` section of `.speckit/mod/config.yaml`. It is a read-only configuration section, **not state**, which is what keeps `05 -> 01` from becoming a `01 <-> 05` cycle. Mods must not invent their own phase lists. The default list includes Constitution where it belongs in the discovered Spec-Kit set. Unknown future Spec-Kit phases are shown with status `unknown`, not dropped.

## 7. Dependencies

- **Hard:** `05` Artifact Tracker. `01` does not rediscover artifacts. Without `05`'s inventory the phase is `unknown` (shown, never guessed).
- **Soft:** `00` Navigator (UI entry only).
- State edges: `01 reads 05`. No other state reads.

## 8. UI

- **Contextual view only** — shown when the user selects ① in the Navigator (or via `/sdd phase`). No permanent panel, no persistent status UI of its own, no navigation row.
- Content: current phase, completed, pending, blocked/failed, relevant artifact names, last update.
- Actions: **Refresh**.
- Empty state: "Not a Spec-Kit project" / "No artifact inventory".
- Unavailable (Navigator absent): textual output of `/sdd-status`.

The compact persistent line (`SDD | PLAN | ...`) is drawn by `00` only.

## 9. Commands

- `/sdd-status` — **compatibility alias**, equivalent to the Navigator's status/entry behavior: with the Navigator present it opens ① (invocation depends on **Spike F**; otherwise returns text); without it, it returns textual phase status (graceful degradation when rich UI is unavailable).
- `/sdd-status refresh` — manual refresh (re-derive from `05`).
- `/sdd-status reset` — clears 01's cached phase state, **only with explicit confirmation** (never modifies Spec-Kit or artifacts).

It must not grow into a second navigation architecture. `/sdd-phase` is not introduced.

## 10. Actions

| Action | Authority |
|---|---|
| Refresh | `01` (read-only recompute) |
| Phase transitions | **Derived** from artifact evidence; `01` never changes a phase on request. Moving forward is done by running a Spec-Kit phase through `03` and passing `06`. |

## 11. Approval / Safety

Read-only with respect to the project: avoids modifying Spec-Kit source files and artifacts. Cannot approve, reject, continue, run or edit anything. Reset requires explicit confirmation.

## 12. Persistence

Session only (`$.state`). Bounded. If a cache is ever needed it is project data under `.speckit/mod/`, never an unkeyed `$.store` value (`$.store` is per plugin and per user, not project-scoped).

## 13. Failure / Unavailable Behavior

- `05` missing or inventory unreadable → `phase.current = unknown`; the view states why.
- Not a Spec-Kit project → capability reports `ready` but phase `NOT_APPLICABLE`-style empty state.
- Navigator absent → `/sdd-status` text.
- Unknown phase id → shown as `unknown`.
- Publishes `capability = { id: "phase", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** fresh Spec-Kit project; partially completed project; completed project; missing artifact; stale artifact; multiple feature directories; unknown future Spec-Kit phase; unavailable UI capability; `05` absent; `/sdd-status refresh` and `reset` (confirmation required).

**Acceptance:**
- [ ] Phase is derived from `05`'s inventory; no independent artifact discovery.
- [ ] No phase becomes complete because a command was typed.
- [ ] No permanent panel, no duplicate navigation, no global shortcut.
- [ ] `/sdd-status` retained as an alias; textual fallback works.
- [ ] Phase model configurable; Constitution included; unknown phases shown.

**Deliverables (later implementation):** `.claude-plugin/plugin.json`, hooks registration, TypeScript source, `types/index.d.ts`, tests, README, configuration example. Use official function-hook/plugin conventions.

**Spikes:** A (view slot), B (observing `05`'s `state.set`; fallback re-derive at turn completion), F (`/sdd-status` → `/sdd phase`).

**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Removed / changed | Where it went | Reason |
|---|---|---|
| Req 2: discover the feature directory and artifacts from the repo | `05` | `05` is the canonical inventory owner; `01` derives. |
| Req 4: compact **persistent** status UI | `00` status line + contextual view | No permanent UI per capability. |
| Req 5: relevant artifact names displayed | Kept in the contextual view, sourced from `05` | Same content, new source. |
| `/sdd-status` | Kept as alias | Compatibility; not a second navigation. |
