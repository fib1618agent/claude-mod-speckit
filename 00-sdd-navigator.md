# SDD Navigator — UI Shell Specification (Claude Code + GitHub Spec-Kit)

> **Role:** UI shell. Not a business-logic Mod.
> **Plugin name (working):** `sdd-navigator`
> **Status:** Amended per `AMEND-SPECKIT-MODS-APPROVED.md`. Specification only; nothing is implemented.
> **Readiness:** READY WITH CAVEATS (Spikes A, E, F — see §22).

## Purpose

One Claude Code Mod that acts as the interactive **UI shell** and launcher for the GitHub Spec-Kit / SDD **capability Mods** in this workspace.

The Navigator is NOT a replacement for the capability Mods. It is the shared UI/navigation layer through which they are exposed. The user experiences **one SDD system**; the eleven capability Mods remain modular.

Target experience:

```text
SDD | ① Phase | ② Prompt | ③ Review | ④ Analyze | ⑤ Artifacts
    | ⑥ Quality | ⑦ Trace | ⑧ Converge | ⑨ History | ⑩ Control | ⑪ Prompts
                                                                 [×]
```

Selecting an item opens that capability's contextual view. Back returns to the Navigator row; Close dismisses the Navigator and returns to normal Claude Code.

---

## 0. Terminology (applies to all 12 specifications)

| Term | Meaning |
|---|---|
| **SDD Navigator** | This Mod (`00`). |
| **UI shell** | The Navigator's role: navigation, selection, view slot, status line. |
| **capability Mod** | One of the 11 functional Mods `01`–`11`. |
| **view** | A capability's contextual UI shown through the Navigator. |
| **owner** | The one Mod that writes a state noun and defines its meaning and type contract. |
| **consumer** | A Mod that reads a noun it does not own. Consumers never write it. |
| **state edge** | A read of another Mod's state noun. State edges MUST be acyclic. |
| **invocation edge** | A request that another Mod perform an action (command, button). Carries no state ownership. |
| **spike** | An API behavior not verifiable from the local API; recorded, never turned into a requirement. |

---

## 1. Scope

Strictly use:

- Claude Code Mods
- Claude Code terminal UI
- GitHub Spec-Kit / Spec-Driven Development
- the existing capability Mods

Do not introduce Cursor, Rust orchestration, external orchestration systems, web dashboards, separate desktop applications, or a replacement implementation of Spec-Kit. Preserve normal Spec-Kit behavior. Do not modify or fork Spec-Kit.

---

## 2. Capability Mods

```text
01-phase-tracker.md                    (sdd-phase-tracker)
02-prompt-manager.md                   (sdd-prompt-manager)
03-prompt-review-gate.md               (sdd-prompt-review)
04-analyze-gate.md                     (sdd-analyze-gate)
05-artifact-tracker.md                 (sdd-artifact-tracker)
06-quality-gate.md                     (sdd-quality-gate)
07-traceability.md                     (sdd-traceability)
08-convergence-tracker.md              (sdd-convergence-tracker)
09-session-history.md                  (sdd-session-history)
10-sdd-control-plane-integration.md    (sdd-control-plane)
11-default-sdd-prompt-pack.md          (content-only; working name sdd-default-prompt-pack)
```

Treat these as independent capabilities. The Navigator MUST NOT duplicate their business logic.

---

## 3. First Action — Inspect Before Implementing (when implementation is later requested)

1. Inspect every capability specification.
2. Inspect the current Claude Code Mods API (`claude-code.d.ts`, `reference.md`, examples) and the installed Claude Code version.
3. Determine which UI surfaces, events, buttons, focus handling, hotkeys, commands, state APIs and plugin interactions are supported.
4. Re-check every spike in §22.

The API available in the build is the authority. Never invent a Claude Code Mod API. If an interaction cannot be implemented with the current API, mark it unsupported and design the closest supported fallback.

---

## 4. Architecture

```text
                         Claude Code
                              |
                              v
                    +--------------------+
                    |   SDD NAVIGATOR    |
                    |     UI SHELL       |
                    +---------+----------+
                              |
                  shared SDD state / owner contracts
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
     01 Phase            02 Prompt            03 Review  ...
          |                   |                   |
          +-------------------+-------------------+
                              |
                    other capability Mods
                              |
                              v
                        GitHub Spec-Kit
```

### 4.1 The Navigator owns

- opening the SDD experience (`/sdd`);
- the top-level navigation row;
- selection and the **active view** (`activeView`);
- the Navigator pane/shell;
- the **single** SDD status line;
- opening the selected capability view in the view slot;
- Back and Close;
- capability availability display;
- keyboard and pointer conventions for navigation;
- common UI conventions.

### 4.2 The Navigator MUST NOT

implement Phase, Prompt Manager, Review Gate, Analyze, Artifact discovery, Quality decisions, Traceability, Convergence or History logic; implement Control Plane aggregation; or own Prompt Pack content.

### 4.3 Each capability Mod owns

its domain logic, analysis, validation, findings, capability-specific state, commands and actions, and its contextual view content.

---

## 5. Navigator Menu

Expose the 11 entries in one compact row where terminal width permits (two rows as shown in the target experience). If the terminal is too narrow, fall back to a vertical list of the same Buttons. Never overflow or corrupt the terminal. Size the tree to the pane body width the API provides (`bodyColumns`), not the full viewport.

Every entry is a real `Button`. The active entry is identified using only supported Button/Text styling (for example `variant="primary"`).

---

## 6. Navigation Mapping (final)

| Key | # | Entry | Target | Notes |
|---|---|---|---|---|
| `1` | ① | Phase | `01` Phase Tracker | |
| `2` | ② | Prompt | `02` Prompt Manager | |
| `3` | ③ | Review | `03` Prompt Review Gate | Empty state: "No prompt pending" + last review. |
| `4` | ④ | Analyze | `04` Analyze Gate | |
| `5` | ⑤ | Artifacts | `05` Artifact Tracker | |
| `6` | ⑥ | Quality | `06` Quality Gate | |
| `7` | ⑦ | Trace | `07` Traceability | |
| `8` | ⑧ | Converge | `08` Convergence Tracker | |
| `9` | ⑨ | History | `09` Session History | |
| `0` | ⑩ | Control | `10` Control Plane | Aggregate/read/delegate view only. |
| `p` | ⑪ | Prompts | `02` Prompt Manager — **Prompt Pack catalog** view | `11` is content-only and owns no UI. |
| `b` | — | Back | Navigator row | Not a capability. |

**Mapping decision (⑪):** the original "Default SDD Prompt Pack / Prompt Manager" was ambiguous. ⑪ is "Prompt Pack Catalog": a read-only catalog rendered by `02` from `11`'s content. It is not another standalone Prompt Manager. Reason: `11` is a content deliverable, and prompt editing/saving/review have a single owner each (`02`, `03`).

The hotkey for ⑪ is lowercase `p`. Uppercase `P` is not valid.

---

## 7. Opening a Capability

Selecting a capability MUST NOT execute a consequential operation. It opens the capability's view. Example (owned by `04`; the Navigator only hosts it):

```text
SDD / ANALYZE

Specification & Design Analysis
...
[Run Analyze] [View Findings]
```

The user explicitly chooses execution; execution of Analyze is delegated through `03` (review and approval). The same principle applies to every consequential operation.

Capability-to-capability navigation (for example Analyze → Review) uses the navigation-request pattern in §13.4.

---

## 8. Close / Back Behavior

```text
Normal Claude Code
        |  /sdd  (command)  or Navigator button
        v
SDD Navigator (row visible, no view or last view)
        |  select capability (button / hotkey / /sdd <view>)
        v
Capability view (in the view slot)
        |  Back button / b
        v
SDD Navigator row
        |  Close button / Esc
        v
Normal Claude Code
```

**Final behavior (no Esc interception assumed):**

- `b` / `[Back]` returns from a capability view to the Navigator row.
- `Esc` closes the **whole** Navigator pane (pane `closeOnEscape`).
- `[× Close]` closes the Navigator.

Two-level Esc (Esc = Back, second Esc = Close) is NOT assumed. Whether a `ui.close` hook may refuse a close is **Spike E**; if it can, two-level Esc may be added later as an enhancement. Do not invent an Esc interception mechanism. Do not interfere with the normal composer.

---

## 9. Keyboard Interaction

Verified API facts: a `Button` `hotkey` is **one digit or one lowercase letter**, and it presses only **while the plugin's pane/site holds focus** (after a click, the person's focus chord, or a pane opened with `focus`). There are no global shortcuts.

| Key | Action |
|---|---|
| `1`–`9` | Open ①–⑨ |
| `0` | Open ⑩ Control |
| `p` | Open ⑪ Prompt Pack catalog |
| `b` | Back |
| `Esc` | Close Navigator (whole pane) |

Rules:

- These are focus-scoped hotkeys, **not global shortcuts**. They do not work while the normal composer has focus. Do not claim otherwise.
- The Navigator pane is a pane (`/sdd` opens it), **not** the `AbovePrompt` band: a bare digit typed into an empty composer arms band Buttons, which would conflict with normal typing.
- The UI MUST remain fully usable without hotkeys (Buttons and pointer).
- Capability views must not use reserved hotkeys: digits `0`–`9`, `p`, `b`. Capability-local hotkeys use other lowercase letters.
- If two hotkeys clash the later wins; avoid by construction.
- No Claude Code-reserved chord is claimed; the optional Button `action` binding is not used by the Navigator.

---

## 10. Mouse / Pointer Interaction

Every navigation item, Back and Close is a real interactive `Button` (the API raises `ui.press` on click). Do not simulate terminal mouse input. `role="dismiss"` marks the Close Button as a drawing hint. Pointer operation is the baseline; hotkeys are an accelerator.

---

## 11. Active View Model

Only one detailed capability view is active at a time. Eleven large permanent panels are forbidden. The Navigator is the only owner of `activeView`.

---

## 12. Persistent vs Contextual UI

**Persistent (Navigator-owned only):** the Navigator entry point (`/sdd`), the Navigator shell while open, and the single status line (`$.ui.status`, one per plugin).

Status line format (no invented scores):

```text
SDD | PLAN | Gate READY | 4/9 | Conv IN_PROGRESS
```

- Phase = current phase from `phase`.
- Gate = status from `quality` (semantics owned by `06`), via `control` summary when `10` is present.
- `4/9` = completed / total phases in the configured phase model.
- Conv = `convergence.state`.

The status line MUST NOT show a numeric quality score such as `Quality 91%` unless `06` explicitly supplies a configured score computed by its own defined formula. Default display uses statuses: `READY`, `NOT_READY`, `BLOCKED`, `WARNING`, `UNKNOWN`, `NOT_APPLICABLE` (mapping from `06`'s gate statuses in `06` §5).

No capability Mod sets its own status line (single status-line ownership).

**Contextual (capability-owned, shown on demand):** Phase detail, Prompt detail, Review card, Analyze view, Artifact matrix, Quality gate, Traceability matrix, Convergence view, History timeline, Control Plane aggregate view.

---

## 13. View-Slot Contract and Shared State

### 13.1 Desired contract (preferred architecture)

The Navigator owns **one** pane (id `sdd`). It draws the navigation row, the status line, Back/Close, and a **view slot**. The selected capability renders its contextual content into the slot as a function of:

- the owner contracts it reads (its own state and its allowed consumed state);
- `navigator.view.activeView` (read-only; used only to decide whether it should render);
- the slot width (`bodyColumns`) and rows.

A capability whose `id` is not the `activeView` MUST pass the draw through unchanged (`next(e)`).

> **Runtime-verified (Spike A, Claude Code 2.1.289).** The Navigator's `ui.render` hook for `{ component: 'Pane', requestId: 'sdd' }` can `await next(e)` and embed the tree returned by the hooks beneath it. A capability's `Button` survives embedding with its `hotkey`, and pressing it reaches the capability's own `onPress` closure.
>
> **Ordering requirement.** The Navigator MUST be the **outer** hook for the shared view-slot architecture, and capability rendering is embedded **beneath** the Navigator's rendered tree. A capability's `Pane` hook for `requestId: 'sdd'` MUST NOT answer before the Navigator: a capability hook that sits outside the Navigator and answers without the Navigator's shell removes the shell (observed with a higher-precedence plugin tier). Capability hooks answer only for their own `activeView` and otherwise call `next(e)`.
>
> **Caveat — real-session load order.** Plugin hook order across plugins in a real session is not controllable by this specification, and no plugin-precedence API is assumed or invented. In the test harness the Navigator remained the outer hook for both list orders at the same tier, but real-session load order is **unverified**.

### 13.2 Fallback (documented, used when the required ordering cannot be guaranteed)

If the Navigator cannot be guaranteed to be the outer hook, use **one active capability pane at a time**. The Navigator pane remains the nav shell; the Navigator opens the selected capability's pane and closes any other capability pane (`$.ui.open` / `$.ui.close` / `$.ui.panes`), so only one capability view is active. Each capability view carries a standard Back affordance following Navigator convention. The user-visible architecture is unchanged: one Navigator, one active view, no competing shell.

**Back and Esc stay distinct in both realizations:** `Esc` closes the Navigator pane; `b` / `[Back]` returns to the Navigator row. `b` is never a substitute for `Esc`.

**Cross-plugin invocation caveat (Spike F).** `$.command.run` must not be called from a hook the same turn is waiting on (it rejects). A capability that asks the Navigator to open a view calls it from a non-blocking UI action such as a Button `onPress`. Button `onPress` invocation of `$.command.run` is **unverified at runtime**; if it fails, show the target key/command as text (§13.5).

### 13.3 State owned by the Navigator

| Noun | Plugin / key | Shape | Persistence | Consumers | Failure |
|---|---|---|---|---|---|
| `navigator.view` | `sdd-navigator` / `view` | `{ isOpen, activeView }` | session | capability view slots | Navigator absent → capabilities fall back to their text commands |

`activeView` is Navigator-private; it is not duplicated as independent state anywhere.

### 13.4 State the Navigator consumes (read-only)

`capability` (all Mods; availability), `phase` (01), `convergence` (08), `history` (09), `control` (10; summary for the status line, including gate status and next action). If `control` is absent the Navigator reads `phase` and `convergence` directly and omits the Gate segment.

The Navigator never writes a noun it does not own. It cannot write `activeView` on behalf of a capability.

### 13.5 Navigation requests from capabilities

A capability that wants the user taken to another view (for example `04` → ③ Review) cannot write `activeView`. Specified order of preference:

1. Invoke `/sdd <view>` via `$.command.run` — **only if Spike F verifies** cross-plugin command invocation.
2. Otherwise, show the target and its key/command as text ("Open ③ Review: press 3 or run `/sdd review`") — no navigating Button.

### 13.6 Derived, not stored

`staleArtifacts` (from `05`), `blockingFindings` (from `04` + `06`), `lastAction` (from `09`) are not independent state and the Navigator MUST NOT create them.

### 13.7 Contract references

Types come from each owner's `types/index.d.ts`; the Navigator declares only `navigator.view`. There is no `sdd-contracts` plugin (decision Q1). Consumers reference the owner's contract; no declaration is copied. A consumer lists the owner under `dependencies` for types only; absence of the owner at run time yields "unavailable" behavior, never an error.

---

## 14. Capability Independence and Availability

The Navigator remains usable if a capability is unavailable, disabled, not yet implemented or incompatible with the project.

- Each capability publishes `capability = { id, version, status }` (session). A missing/never-written value means **unavailable**.
- `status` is `ready`, `degraded` or `unavailable`; a `degraded`/`unavailable` Mod MAY add a short `reason` string (additive field, recorded as an extension of the contract).
- Unavailable entry rendering: `SDD | Phase | Prompt | Review | [Analyze unavailable] | Artifacts ...`. Selecting it opens the unavailable view (§17).
- One unavailable capability MUST NOT crash the Navigator or the session.

Every capability also remains meaningful **without the Navigator** through its own commands and state ownership (see each spec's §13).

---

## 15. Spec-Kit Integration

The Navigator does not replace Spec-Kit commands. It is a UI entry into Mods that augment Spec-Kit. Respect existing Spec-Kit artifacts and workflows. Do not modify or fork Spec-Kit.

```text
Navigator
    |
    +-- Analyze view (04)
          |
          +-- Run  -> delegated to 03 (review + approval)
                         |
                         v
                   Spec-Kit analysis (read-only)
```

---

## 16. Human-in-the-Loop

Human approval is mandatory before: executing analysis, modifying artifacts, regenerating prompts, changing requirements, triggering implementation, destructive operations, approving/rejecting a gate, changing a phase, and continuing after a quality gate.

The Navigator is a navigation/control surface, not an autonomous executor. A Button in a view never bypasses the capability's approval gate; it delegates to the gate's owner.

---

## 17. Error Handling and Empty States

Unavailable capability:

```text
SDD / ANALYZE

Capability unavailable
Analyze Gate is unavailable.

Reason:
<clear reason>

[Back]
```

Every capability view needs a meaningful empty state (for example ③: "No prompt pending" plus last review where available). If the UI API is unavailable, provide only a fallback command that actually exists (`/sdd`, `/sdd <view>` and the capability commands in §18). Do not crash the session.

---

## 18. Commands

| Command | Behavior |
|---|---|
| `/sdd` | Open the Navigator. Registered via `$.command.register`; answered by a `command.run` hook; person-initiated so the pane seats at any width. |
| `/sdd <view>` | Open the Navigator at `phase\|prompt\|review\|analyze\|artifacts\|quality\|trace\|converge\|history\|control\|prompts`. |
| `/sdd-status` | Owned by `01`; **compatibility alias** equivalent to Navigator status/entry behavior (see `01`). Not a second navigation architecture. |

Capability commands (`/sdd-prompt`, `/sdd-artifacts`, `/sdd-history`, and fallbacks `/sdd-review`, `/sdd-analyze`, `/sdd-quality`, `/sdd-trace`, `/sdd-converge`, `/sdd-run <phase>`) are owned by their capability specs. `/sdd-phase` is intentionally not introduced (it would duplicate `/sdd-status`). When the Navigator is present, a capability command opens its view through `/sdd <view>` only if Spike F verifies; otherwise it returns its textual output.

---

## 19. Testing

### Navigation
- Navigator opens via `/sdd`; each item selects the correct capability; active selection is represented; Back returns to the row; Close dismisses.

### Keyboard
- Hotkeys `1`–`9`,`0`,`p`,`b` activate the right control **while the pane holds focus**.
- Esc closes the whole Navigator.
- Normal composer input is unaffected when the Navigator is not focused.

### Pointer
- Each Button can be pressed; Close works; active capability changes.

### State
- `navigator.view` is correct; shared state stays consistent.
- A missing capability does not crash the Navigator.
- Status line shows statuses, never an invented score.

Use the Claude Code Mod test framework and the supported terminal surface(s). Loop the body over supported surfaces where claimed. Do not claim support for untested surfaces.

---

## 20. UI Responsibility Matrix (authoritative)

| Mod | Owns UI | Navigator entry | Persistent | Contextual | Actions |
|---|---|---|---|---|---|
| 00 Navigator | Shell, navigation, status line | `/sdd` | Status line | n/a | Open, Back, Close |
| 01 Phase | Phase detail | ① | None | Yes | Refresh |
| 02 Prompt Manager | Prompt detail and Pack catalog | ② and ⑪ | None | Yes | Show, Edit, Save, Reset |
| 03 Review Gate | Review card | ③ | None | Yes | Edit, Run, Cancel, Save Template |
| 04 Analyze | Analysis | ④ | None | Yes | Run, Re-run, Findings |
| 05 Artifacts | Artifact matrix | ⑤ | None | Yes | Open artifact |
| 06 Quality | Gate view | ⑥ | None | Yes | Approve, Reject, Continue, Findings |
| 07 Trace | Trace matrix | ⑦ | None | Yes | Review gap, Open source, Re-run/request |
| 08 Converge | Convergence | ⑧ | None | Yes | Review, Request re-analyze, Mark exception |
| 09 History | Timeline | ⑨ | None | Yes | Open item, Clear |
| 10 Control | Aggregate | ⑩ | None | Yes | Delegates only |
| 11 Prompt Pack | None | ⑪ via 02 | None | None | None |

(`06` also owns Continue; the matrix in the approved brief lists Approve/Reject/Findings, and §24 of the brief makes Continue a `06` action.)

---

## 21. Acceptance Criteria

- [ ] Navigator is a Claude Code Mod (UI shell) opened via `/sdd`.
- [ ] All 11 entries present; ⑪ resolves to `02`'s Prompt Pack catalog.
- [ ] Row is compact; narrow-terminal fallback exists.
- [ ] Only one detailed view active at a time.
- [ ] Pointer and focus-scoped keyboard work; hotkeys never described as global.
- [ ] `b` Back, `Esc` closes whole Navigator; no Esc interception invented.
- [ ] Composer behavior preserved.
- [ ] No capability business logic in the Navigator.
- [ ] Single status line; no invented numeric score.
- [ ] Missing/disabled capabilities handled safely.
- [ ] Spec-Kit not forked or modified.
- [ ] Tests cover navigation, close/back, availability.
- [ ] No unsupported API invented; spikes recorded.

---

## 22. Implementation Spikes and API Compatibility

| Spike | Question | Fallback |
|---|---|---|
| **A** View slot | **Runtime-verified:** embedding works with the Navigator as outer hook; hotkeys survive. Real-session load order unverified. | One capability pane at a time, opened/closed by the Navigator (§13.2). |
| **B** State observation | **Runtime-verified (harness):** a non-owner `state.set` hook sees the key, `e.previous` is stamped, and the new value is readable after `await next(e)`. Real-session redraw timing unverified. | Render-time `$.state.get` subscription; re-derive at `turn.complete`. |
| **E** Esc | A `ui.close` hook denies a close with `{ deny }` (verified for plugin origin). Person-origin Esc itself unverified. | Esc closes the Navigator pane; `b` is Back. No redesign. |
| **F** `command.run` | **Runtime-verified:** works from a later event (not inside an awaited `command.run` hook); the target sees `origin {kind:'plugin', name}`. Button `onPress` use unverified. | Textual guidance; no navigating Button. |

**Verified in the local API:** panes (`$.ui.open`, `ui.render` on `Pane`), `Button` (`hotkey` one digit/lowercase letter, focus-scoped; `variant`; `role="dismiss"`), `closeOnEscape`, `$.ui.status` (one per plugin), `$.command.register`/`command.run`, `$.state` (any reads, owner writes), `$.store`.
**Unsupported:** global keyboard shortcuts; uppercase hotkeys; multi-key hotkeys.

---

## 23. Mandatory Implementation Workflow (retained for the later implementation task)

Do not implement during this amendment. When implementation is requested:

1. **A. API Compatibility Report** (UI primitives, Button behavior, hotkeys, focus, pointer, surfaces, state/store, commands, limitations — including spike results).
2. **B. Integration Map** (per capability: entry, state consumed, UI, actions, dependencies).
3. **C. Conflict Report** (keyboard, event, state, duplicate UI, cycles, unsupported requirements).
4. **D. Implementation Plan.**

STOP and ask:

```text
SDD Navigator implementation plan is ready.

No implementation has been performed.

Approve implementation? [Yes / No]
```

Only after approval: implement Navigator, contracts, integrations, tests; run tests; validate the terminal UI; report exactly what changed; do not silently change unrelated Mods.

---

## 24. Changed Ownership / Removed Responsibility (this amendment)

| Item | Was | Now | Reason |
|---|---|---|---|
| Shared state list (`currentPhase`, `artifactStatus`, ...) | Candidate Navigator list | Per-owner contracts (`phase`, `artifacts`, ...) | Owner-based state; no duplicated declarations. |
| `Quality 91%` in status line | Example persistent line | Status words only | `06` forbids invented scores. |
| `activeView` | Shared candidate | Navigator-private | Single owner. |
| `staleArtifacts`, `blockingFindings`, `lastAction` | Shared candidates | Derived | No competing state. |
| Two-level Esc | Preferred state machine | `b` + Esc closes pane | Not supported without Spike E. |
| ⑪ target | "Prompt Pack / Prompt Manager" | `02` catalog view | `11` is content-only. |
| `control` noun | — | Added (owner `10`) | Required by the `10 → 00` status-line edge. |

---

## 25. Design Principle

```text
                SDD
                 |
        +--------+--------+
        |                 |
     Navigate          Operate
        |                 |
  choose capability   approve action (owner's gate)
        |                 |
        +--------+--------+
                 |
            Spec-Kit
```

The Navigator is the front door. The capability Mods remain the capabilities behind that door.
