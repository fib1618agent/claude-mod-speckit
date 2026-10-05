# Spec — Spec-Kit SDD Artifact Tracker (capability Mod 05)

> **Plugin name:** `sdd-artifact-tracker` · **Navigator entry:** ⑤ (`5`) · **Readiness:** READY WITH CAVEATS (Spikes A, B)
> Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only. Terminology: see `00-sdd-navigator.md` §0.

## 1. Purpose

The **canonical owner of artifact truth** for the SDD Mod family: artifact inventory, existence, hashes, modification timestamps, producing phase, dependency phase, status, and freshness/staleness. Tracks the lifecycle and freshness of Spec-Kit artifacts. Never equates file existence with correctness.

## 2. Scope

**In scope:** discovery of the actual Spec-Kit artifact layout (not hard-coded when discovery is possible), inventory, freshness derivation, invalidation state, the artifact matrix view.
**Out of scope:** deciding phase (`01` derives from this), quality decisions (`06`), traceability IDs (`07`), analysis (`04`), navigation (`00`).

Artifacts tracked, as discoverable: constitution; specification; clarification decisions; plan; checklist; tasks; analysis results; implementation evidence; convergence results.

## 3. Inputs

- The actual Spec-Kit artifact layout in the repository/tooling.
- The phase model from the `phase:` configuration section (read-only configuration, not state) to know each artifact's producing and dependency phase.
- File metadata via the supported filesystem API: existence, size, mtime, content hash where safe.
- Events that suggest change (tool calls that write, turn completion) as triggers for re-scan; the file system, not the event, is the truth.

## 4. Outputs

`artifacts` state; the artifact matrix view; derived staleness for consumers.

## 5. State

Owned noun `artifacts` (plugin `sdd-artifact-tracker`, key `artifacts`):

```text
{
  items[
    {
      id,
      exists,
      hash,
      mtime,
      producedBy,
      dependsOn,
      fresh
    }
  ]
}
```

Additive per-item metadata the original requirements need and the contract may carry: `size`, `path` (relative), `status`. Metadata and hashes only; **do not store full source/spec contents** and do not upload project data externally.

### Staleness model (single, derived)

`fresh` is derived from `dependsOn` and hashes/mtimes. Cases that must be detected: spec changed after plan; plan changed after tasks; tasks changed after analyze; implementation changed after analyze; analyze result stale relative to source artifacts. `staleArtifacts` is **not** independent state — it is `items.filter(!fresh)`. There is exactly one staleness model.

## 6. Contracts

- Owned: `artifacts` (`types/index.d.ts`, plugin `sdd-artifact-tracker`). Consumers: `01`, `06`, `07`, `08`, `10`. `09` observes.
- Consumed: none (state). Phase model is read from configuration, which avoids a `01 ↔ 05` cycle.

## 7. Dependencies

- **Hard:** none.
- **Soft:** `00` (UI entry only).
- Inbound state edges: `01`, `06`, `07`, `08`, `10` read this noun.

## 8. UI

Contextual **artifact matrix** (no permanent panel):

```text
Artifact | Exists | Fresh | Source Phase | Depends On | Status
```

- Action: **Open artifact** — "allow opening/reviewing artifacts through supported host mechanisms". No verified open-in-editor API exists in the local Mods API; fallback is to show the artifact's relative path (and, if useful, put a reference into the composer with `$.prompt.fill`), never to read or alter it silently.
- Empty state: "No Spec-Kit artifacts found."
- Stale rows carry a text marker plus icon-free label (never color alone).

## 9. Commands

- `/sdd-artifacts` — text matrix; opens ⑤ when the Navigator is present and Spike F permits.

## 10. Actions

**Open artifact** (read-only), **Refresh**. No action modifies artifacts.

## 11. Approval / Safety

Does not modify artifacts. Read-only filesystem access with real-path resolution and an allow-list under the project root. Hash only where safe (skip secrets/large/binary files by policy). No external upload. Cannot approve, reject, continue or run anything.

## 12. Persistence

Metadata may use `$.store`, **project-keyed** (the store is per plugin and per user, not project-scoped). Project data otherwise stays under `.speckit/mod/`. The inventory is always recomputable from the file system; the store is a cache of previous hashes used to detect "changed since".

## 13. Failure / Unavailable Behavior

- Unreadable artifact → `fresh` unknown, item flagged `unknown` (original: missing/unreadable is reported, not assumed).
- Not a Spec-Kit project → empty inventory with reason.
- Navigator absent → `/sdd-artifacts` text.
- Publishes `capability = { id: "artifacts", version, status }`.

## 14. Acceptance / Implementation Readiness

**Testing:** missing, modified, deleted, regenerated and stale artifacts; each of the five staleness cases; unreadable artifact; no full contents stored; no modification of artifacts; project-keyed cache isolation between two projects.

**Acceptance:**
- [ ] Single artifact inventory owner; `01` derives from it.
- [ ] One staleness model; no `staleArtifacts` state.
- [ ] Metadata and hashes only; project-scoped persistence.
- [ ] Contextual matrix only.

**Deliverables (later):** plugin, tests, README.
**Spikes:** A; B (publishing update ordering to non-render consumers; fallback re-derive at turn completion).
**Readiness:** READY WITH CAVEATS.

### Changed Ownership / Removed Responsibility

| Item | Detail | Reason |
|---|---|---|
| Became canonical inventory | Absorbs `01` req 2 discovery | One owner for artifact truth. |
| Added | Inventory contract, project-scoped persistence, freshness derivation, consumer `07` | Approved amendment; `07` needs source locations. |
| Phase model | Read from configuration, not from `01` state | Break the `01 ↔ 05` cycle. |
