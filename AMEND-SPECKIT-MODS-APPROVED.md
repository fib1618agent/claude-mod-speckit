# AMEND-SPECKIT-MODS-APPROVED.md

# Claude Code Spec-Kit Mods — Approved Navigator-Aware Amendment

## 0. Purpose

Amend the existing Claude Code Spec-Kit / SDD Mod specifications so they form one coherent modular SDD system with:

- one shared Navigator UI shell;
- eleven capability Mods;
- clear ownership of state, UI, commands, gates, and artifacts;
- explicit inter-Mod contracts;
- no duplicated responsibilities;
- human approval preserved at consequential boundaries;
- compatibility with the actual Claude Code Mods API available in this build.

This task is a **SPECIFICATION AMENDMENT task**.

Do NOT implement the Mods during this task.

Do NOT create TypeScript implementations.

Do NOT create plugin manifests.

Do NOT create hooks.

Do NOT install plugins.

Do NOT modify Claude Code configuration.

Do NOT create tests.

Do NOT execute destructive commands.

Do NOT silently invent unsupported Claude Code APIs.

---

# 1. Workspace

The target directory is:

`/Users/imdadareeph/Downloads/claude-mods/claude-mod-speckit`

The specification set is exactly:

```text
00-sdd-navigator.md
01-phase-tracker.md
02-prompt-manager.md
03-prompt-review-gate.md
04-analyze-gate.md
05-artifact-tracker.md
06-quality-gate.md
07-traceability.md
08-convergence-tracker.md
09-session-history.md
10-sdd-control-plane-integration.md
11-default-sdd-prompt-pack.md
```

The amendment brief is:

`/Users/imdadareeph/Downloads/AMEND-SPECKIT-MODS.md`

The brief is NOT itself one of the twelve specifications.

---

# 2. Mandatory first action

Before changing anything:

1. Read all twelve specifications 00–11 completely.
2. Read `AMEND-SPECKIT-MODS.md` completely.
3. Inspect the actual Claude Code Mods API available to this build.
4. Inspect:
   - `claude-code.d.ts`
   - `reference.md`
   - examples
   - relevant local plugin-authoring material
5. Do not assume that an API described in a specification exists.
6. Do not replace the local API with generic Claude Code knowledge.
7. Treat the actual API available in this build as the implementation authority.

The Claude Code Mods model uses function hooks, typed noun contracts, plugin composition, and plugin-local `types/index.d.ts` contracts. A Mod that owns a noun owns its type contract; consumers must use that contract rather than duplicate it.

The Mods API is early access and may change between releases.

---

# 3. Critical scope boundary

This task modifies Markdown specifications only.

The final result must describe what should be implemented later.

It must NOT implement:

- TypeScript;
- JavaScript;
- JSX;
- hooks;
- `plugin.json`;
- `hooks.json`;
- tests;
- shell scripts;
- installation;
- configuration changes;
- runtime wiring;
- plugin registration.

If an implementation detail cannot yet be verified from the API, document it as an implementation spike or caveat.

Do not convert uncertainty into a false requirement.

---

# 4. System architecture

The target architecture is:

```text
                         Claude Code
                              |
                              v
                    +-------------------+
                    |   00 SDD         |
                    |   NAVIGATOR       |
                    |   UI SHELL        |
                    +---------+---------+
                              |
                    shared SDD state/contracts
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
     01 Phase           02 Prompt            03 Review
          |                   |                   |
          +-------------------+-------------------+
                              |
                         04 Analyze
                              |
                         05 Artifacts
                              |
                         06 Quality
                              |
                         07 Trace
                              |
                         08 Converge
                              |
                         09 History
                              |
                         10 Control
                              |
                         11 Prompt Pack
```

The Navigator is the shared UI entry point.

The Navigator does NOT own the business logic of the capabilities.

The capability Mods own their respective domains.

The Control Plane is an aggregate/read/delegate view.

The Prompt Pack is content-only.

---

# 5. Capability mapping

The Navigator mapping is:

```text
1  -> 01-phase-tracker.md
2  -> 02-prompt-manager.md
3  -> 03-prompt-review-gate.md
4  -> 04-analyze-gate.md
5  -> 05-artifact-tracker.md
6  -> 06-quality-gate.md
7  -> 07-traceability.md
8  -> 08-convergence-tracker.md
9  -> 09-session-history.md
0  -> 10-sdd-control-plane-integration.md
p  -> 11-default-sdd-prompt-pack.md
```

The Navigator MUST use lowercase `p`.

Uppercase `P` is NOT a valid Navigator hotkey.

---

# 6. Navigator ownership

`00-sdd-navigator.md` owns:

- opening the SDD experience;
- the top-level navigation;
- the active capability;
- the Navigator shell;
- the Navigator status line;
- opening the selected capability view;
- returning to Navigator;
- closing the Navigator;
- capability availability state;
- common navigation semantics.

The Navigator MUST NOT:

- implement Phase logic;
- implement Prompt Manager logic;
- implement Review Gate logic;
- implement Analyze logic;
- implement Artifact discovery;
- implement Quality decisions;
- implement Traceability logic;
- implement Convergence logic;
- implement History logic;
- implement Control Plane orchestration;
- own Prompt Pack content.

---

# 7. Capability UI ownership

Each capability may own a contextual view.

The capability view is displayed through the Navigator experience.

Capabilities MUST NOT create their own competing permanent navigation shell.

Capabilities MUST NOT create duplicate top-level navigation.

Capabilities MUST NOT create global keyboard shortcuts.

Capabilities MUST NOT redefine another capability's actions.

Capabilities MAY provide:

- contextual information;
- contextual buttons;
- capability-specific forms;
- capability-specific findings;
- capability-specific actions.

---

# 8. Persistent versus contextual UI

The intended model is:

Persistent:

- Navigator entry point;
- Navigator shell;
- Navigator status line.

Contextual:

- Phase detail;
- Prompt detail;
- Review card;
- Analyze view;
- Artifact matrix;
- Quality gate;
- Traceability matrix;
- Convergence view;
- History timeline;
- Control Plane aggregate view.

The Prompt Pack has no UI ownership.

Its content is surfaced through Prompt Manager.

---

# 9. Navigator keyboard model

The verified API supports button hotkeys consisting of:

- one digit; or
- one lowercase letter;

while the plugin's UI site/pane holds focus.

Therefore:

```text
1 -> Phase
2 -> Prompt
3 -> Review
4 -> Analyze
5 -> Artifacts
6 -> Quality
7 -> Trace
8 -> Converge
9 -> History
0 -> Control
p -> Prompt Pack catalog
b -> Back
```

Esc closes the whole Navigator pane.

Do NOT describe these as global shortcuts.

Do NOT claim that these shortcuts work while the normal Claude Code composer has focus.

The UI must remain usable without hotkeys.

Buttons/pointer interaction must remain available.

---

# 10. Back behavior

Two-level Esc behavior is NOT assumed.

If the API does not support intercepting Esc to implement:

```text
Navigator
  -> Capability
  -> Navigator
```

then use:

```text
b = Back
Esc = close Navigator
```

Document this explicitly.

Do not invent an Esc interception mechanism.

---

# 11. Slash-command fallback

The system must remain usable through commands.

At minimum, the Navigator concept should support an entry command equivalent to:

```text
/sdd
```

Capability-specific commands may be retained where they already exist.

Examples:

```text
/sdd-status
/sdd-phase
/sdd-prompt
/sdd-review
/sdd-analyze
/sdd-artifacts
/sdd-quality
/sdd-trace
/sdd-converge
/sdd-history
```

Do not invent command APIs.

Verify whether `$.command.run` can invoke another plugin's registered command.

If that is not verified, document it as an implementation spike.

---

# 12. /sdd-status

01 currently has `/sdd-status`.

This command overlaps with the Navigator.

Do NOT remove it automatically.

Instead:

- retain it as a compatibility/alias command;
- define it as equivalent to the Navigator's status/entry behavior;
- do not let it become a second navigation architecture.

The Navigator remains the primary UI entry point.

---

# 13. Shared state model

Claude Code's state model is:

- plugins can read shared state;
- only the owner writes its state;
- contracts must be typed;
- session-scoped state is distinct from persistence.

Use owner-based state contracts.

Do NOT duplicate a noun's type declaration in multiple Mods.

---

# 14. Q1 — Shared contracts decision

**DO NOT create a separate `sdd-contracts` plugin at this stage.**

Use per-owner `types/index.d.ts` contracts.

The Mod that owns a shared noun owns:

- the noun;
- its type contract;
- the semantic meaning of that noun.

Consumers reference the owner's contract.

Do not copy the declaration into another Mod.

Reconsider a separate contracts plugin only if later implementation proves that a genuine cross-owner contract cannot be cleanly owned by one capability.

For this amendment, no `sdd-contracts` plugin is required.

---

# 15. Shared state contract

Use the following ownership model.

## capability

Owner:

each Mod

Consumers:

00 Navigator  
10 Control Plane

Shape:

```text
{
  id,
  version,
  status
}
```

Persistence:

session

Failure:

missing capability = unavailable

---

## navigator.view

Owner:

00 Navigator

Consumers:

capability view slots

Shape:

```text
{
  isOpen,
  activeView
}
```

Persistence:

session

Failure:

Navigator absent = text-command fallback

---

## phase

Owner:

01 Phase Tracker

Consumers:

00 Navigator  
06 Quality  
10 Control Plane

Shape:

```text
{
  current,
  next,
  phases[
    {
      id,
      status,
      evidence
    }
  ],
  at
}
```

Persistence:

session

Failure:

no artifact inventory = unknown

---

## promptResolution

Owner:

02 Prompt Manager

Consumers:

03 Review Gate  
09 Session History

Shape:

```text
{
  phase,
  templateId,
  version,
  hash,
  layers[]
}
```

Persistence:

project files under:

```text
.speckit/mod/
```

Failure:

missing template = blocked run

---

## review

Owner:

03 Prompt Review Gate

Consumers:

06 Quality  
09 Session History  
10 Control Plane

Shape:

```text
{
  phase,
  promptHash,
  state
}
```

State:

```text
pending
approved
cancelled
```

Persistence:

session

Failure:

no approval = no run

---

## analyze

Owner:

04 Analyze Gate

Consumers:

06 Quality  
08 Convergence  
10 Control Plane

Shape:

```text
{
  at,
  countsBySeverity,
  findings,
  artifactHashes
}
```

Persistence:

project-keyed `$.store`

Failure:

artifact hashes differ = stale

Findings must be bounded.

---

## artifacts

Owner:

05 Artifact Tracker

Consumers:

01 Phase  
06 Quality  
08 Convergence  
10 Control Plane

Shape:

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

Persistence:

metadata may use `$.store`.

Project data must remain project-scoped.

Failure:

unreadable artifact = unknown

---

## quality

Owner:

06 Quality Gate

Consumers:

03 Review Gate  
08 Convergence  
10 Control Plane

Shape:

```text
{
  gates,
  blockers,
  warnings,
  approval
}
```

Persistence:

`$.store`

Failure:

stale evidence = `NOT_READY`

---

## trace

Owner:

07 Traceability

Consumers:

04 Analyze  
06 Quality  
08 Convergence  
10 Control Plane

Shape:

```text
{
  counts,
  gaps[]
}
```

Persistence:

session unless the original specification requires otherwise.

Failure:

no IDs = `NOT_APPLICABLE`

---

## convergence

Owner:

08 Convergence Tracker

Consumers:

00 Navigator  
10 Control Plane

Shape:

```text
{
  state,
  regressions[],
  exceptions[]
}
```

Persistence:

`$.store`

Failure:

no evidence = never `CONVERGED`

---

## history

Owner:

09 Session History

Consumers:

00 Navigator  
10 Control Plane

Shape:

bounded entries

Persistence:

project-keyed `$.store`

Failure:

cleared by:

```text
/sdd-history clear
```

---

# 16. Derived state

Do NOT create independent state for:

- `staleArtifacts`
- `blockingFindings`
- `lastAction`
- `activeView`

These are derived:

`staleArtifacts`:

derived from 05 Artifact Tracker.

`blockingFindings`:

derived from 04 Analyze and 06 Quality.

`lastAction`:

derived from 09 Session History.

`activeView`:

Navigator-private state.

Capabilities may consume `activeView` only when required to determine what to render.

---

# 17. State update mechanism

The state owner writes with:

```text
$.state.set
```

Render-time readers should redraw from the current state.

For non-render consumers:

- use state.set observation where supported;
- use a re-derive fallback at turn completion where ordering is uncertain.

Do not assume post-write hook ordering unless verified by the API spike.

---

# 18. Persistence rules

`$.store` is:

- per plugin;
- per user;
- limited in size.

It is NOT a project persistence mechanism.

Therefore:

Project-scoped data MUST be stored under:

```text
.speckit/mod/
```

using the filesystem mechanisms supported by the actual API.

Use project-keyed records when `$.store` is unavoidable.

Do not describe `$.store` as project-scoped.

---

# 19. Configuration ownership

Configuration is currently associated with:

```text
.speckit/mod/config.yaml
```

Do NOT make 10 the exclusive owner of every configuration value.

Instead:

Each Mod reads its own namespaced configuration section.

10 provides:

- aggregate configuration view;
- configuration editing UI;
- validation/delegation.

10 does NOT become a runtime orchestration authority merely because it provides the configuration view.

Conceptual structure:

```text
.speckit/mod/config.yaml

phase:
  ...

prompt:
  ...

review:
  ...

analyze:
  ...

artifacts:
  ...

quality:
  ...

trace:
  ...

convergence:
  ...

history:
  ...

control:
  ...

navigator:
  ...
```

Do not hard-code exact YAML schemas unless already specified.

---

# 20. Phase model

All Mods must use the discovered Spec-Kit phase set.

Do not allow individual Mods to invent different phase lists.

Constitution must be included where it belongs in the discovered Spec-Kit set.

The phase model must be configurable rather than independently hard-coded into each Mod.

The phase model should live in configuration/contract so that:

```text
05 -> 01
```

does not create a 01 <-> 05 cycle.

---

# 21. Dependency graph

Use this dependency model:

```text
11 Prompt Pack
    ->
02 Prompt Manager
    ->
03 Prompt Review Gate
    ->
06 Quality Gate

05 Artifact Tracker
    ->
01 Phase Tracker

05 Artifact Tracker
    ->
06 Quality Gate

07 Traceability
    ->
04 Analyze
    ->
06 Quality Gate

05 + 04 + 06 + 07
    ->
08 Convergence

all capabilities
    ->
09 Session History

all capability state
    ->
10 Control Plane

10 Control Plane
    ->
00 Navigator
```

Important:

State-read dependencies must remain acyclic.

Invocation/request edges do not automatically imply state ownership.

---

# 22. Human approval rule

Human approval is mandatory before consequential operations.

No capability may bypass an approval gate merely because it has a UI button.

Approval-sensitive operations include:

- running a reviewed prompt;
- changing a phase;
- modifying requirements;
- modifying generated artifacts;
- regeneration;
- implementation;
- destructive actions;
- approval;
- rejection;
- continuing after a quality gate.

If a capability requests an operation, it must delegate to the owner of the corresponding gate.

---

# 23. Review Gate ownership

03 is the sole phase/prompt interceptor.

03 owns:

- interception;
- prompt resolution;
- review state;
- approval entry;
- cancellation;
- run delegation;
- approval fallback.

03 must include:

- re-entry protection;
- plugin-origin protection;
- drop reason;
- quality gate check;
- `$.ui.ask` fallback;
- Constitution phase;
- Edit fallback.

No other Mod may independently intercept the same phase request.

---

# 24. Quality Gate ownership

06 is the sole owner of:

- Approve;
- Reject;
- Continue.

Remove duplicated Approve/Reject/Continue ownership from:

04  
08  
10

Other Mods may request an approval-related operation.

06 makes the decision.

10 delegates.

---

# 25. Analyze ownership

04 owns:

- semantic analysis;
- analysis execution;
- analysis findings;
- Run;
- Re-run;
- Findings view.

04 does NOT own:

- approval;
- prompt editing;
- traceability ID graph;
- artifact inventory.

Remove:

- Continue;
- Edit Prompt.

Analyze runs must be delegated through 03 where review/approval is required.

---

# 26. Analyze read-only protection

When an Analyze run is active, the specification may require read-only enforcement.

The supported mechanism is:

```text
tool.call
```

with deny behavior for:

- Write;
- Edit;
- mutating Bash operations.

Bash detection is best-effort.

Do not describe this as an absolute security boundary.

The specification must explicitly label it as best-effort enforcement.

---

# 27. Artifact Tracker ownership

05 is the canonical owner of artifact inventory.

05 owns:

- artifact discovery;
- inventory;
- existence;
- hashes;
- modification timestamps;
- producers;
- dependencies;
- freshness.

01 must derive phase state from 05.

01 must not independently rediscover artifacts.

Staleness is derived from artifact state.

Do not create multiple competing staleness models.

---

# 28. Traceability ownership

07 owns:

- deterministic requirement IDs;
- ID-link graph;
- traceability matrix;
- gaps;
- orphan tasks;
- source links.

07 must NOT own prompt editing.

Remove:

```text
Edit Traceability Prompt
```

from 07.

Prompt editing belongs to 02.

If deterministic ID extraction does not require a prompt template, do not invent one.

04 may consume traceability gaps as evidence.

---

# 29. Convergence ownership

08 owns:

- convergence state;
- regressions;
- exceptions;
- review;
- request re-analysis;
- mark exception.

08 MUST NOT directly re-run Analyze.

Replace:

```text
re-run Analyze
```

with:

```text
request re-analyze
```

The request must route through the review/approval mechanism.

08 cannot bypass 03 or 06.

---

# 30. Session History ownership

09 owns historical records.

09 is primarily an observer.

It may observe state changes where supported.

Because hook ordering may be uncertain:

- use state.set observation where verified;
- otherwise re-derive at turn completion.

History persistence must be project-keyed if using `$.store`.

History must remain bounded.

`/sdd-history clear` clears the appropriate history.

---

# 31. Control Plane transformation

10 MUST be transformed from an orchestration Mod into an aggregate control-plane view.

10 owns:

- aggregate view;
- derived `nextAction`;
- configuration view;
- event-flow documentation;
- acceptance fixture.

10 does NOT own:

- phase interception;
- approval;
- rejection;
- Continue;
- Analyze execution;
- prompt editing;
- artifact discovery;
- traceability;
- convergence decisions;
- Navigator navigation.

The existing 14-step pipeline must NOT be implemented as a second orchestration engine.

Convert the 14 steps into a documented event-flow table showing:

- triggering capability;
- consumed state;
- produced state;
- delegated action;
- approval requirement.

10 observes and aggregates.

10 does not replace the individual Mods.

---

# 32. Prompt Pack transformation

11 is content-only.

11 owns:

- default SDD prompt templates;
- prompt pack metadata;
- versions;
- content.

11 does NOT own:

- UI;
- prompt editing;
- prompt saving;
- prompt review;
- approval;
- navigation.

The Navigator's ⑪ entry must resolve to a read-only catalog view rendered by 02 Prompt Manager.

Therefore:

```text
11 -> content
02 -> catalog/editing UI
03 -> review
```

---

# 33. Prompt Manager ownership

02 owns:

- prompt display;
- prompt editing;
- prompt save;
- prompt reset;
- prompt resolution;
- prompt catalog UI.

02 must surface the ⑪ Prompt Pack catalog.

The ⑪ Navigator entry therefore means:

"Prompt Pack Catalog"

not:

"another standalone Prompt Manager".

---

# 34. Prompt Review Gate

03 owns the pending review experience.

If no prompt is pending, show:

```text
No prompt pending
```

and optionally:

```text
Last review
```

03 must support:

- review;
- edit fallback;
- save template;
- run;
- cancel;
- approval;
- re-entry protection.

If approval is unavailable through UI, use the supported `$.ui.ask` fallback.

If `$.ui.ask` is rejected in `-p`, fail closed.

---

# 35. Empty states

Every Navigator capability must have a meaningful empty/unavailable state.

Example:

03 Review:

```text
No prompt pending
```

plus last review where available.

Unavailable capability:

```text
Capability unavailable
```

Do not crash the Navigator if an optional capability is missing.

---

# 36. Quality display

Do NOT display invented numeric quality scores.

The Navigator must not display:

```text
Quality 91%
```

unless 06 explicitly supplies a configured score according to its own defined formula.

Default display should be statuses such as:

- READY;
- NOT_READY;
- BLOCKED;
- WARNING;
- UNKNOWN;
- NOT_APPLICABLE;

or equivalent statuses already defined by the capability.

06 owns the semantics.

---

# 37. UI responsibility matrix

The final specifications must converge on this matrix:

| Mod | Owns UI | Navigator Entry | Persistent | Contextual | Actions |
|---|---|---|---|---|---|
| 00 Navigator | Shell, navigation, status line | `/sdd` | Status line | n/a | Open, Back, Close |
| 01 Phase | Phase detail | ① | None | Yes | Refresh |
| 02 Prompt Manager | Prompt detail and Pack catalog | ② and ⑪ | None | Yes | Show, Edit, Save, Reset |
| 03 Review Gate | Review card | ③ | None | Yes | Edit, Run, Cancel, Save Template |
| 04 Analyze | Analysis | ④ | None | Yes | Run, Re-run, Findings |
| 05 Artifacts | Artifact matrix | ⑤ | None | Yes | Open artifact |
| 06 Quality | Gate view | ⑥ | None | Yes | Approve, Reject, Findings |
| 07 Trace | Trace matrix | ⑦ | None | Yes | Review gap, Open source, Re-run/request |
| 08 Converge | Convergence | ⑧ | None | Yes | Review, Request re-analyze, Mark exception |
| 09 History | Timeline | ⑨ | None | Yes | Open item, Clear |
| 10 Control | Aggregate | ⑩ | None | Yes | Delegates only |
| 11 Prompt Pack | None | ⑪ via 02 | None | None | None |

---

# 38. View-slot architecture

The preferred architecture is:

00 Navigator owns one shell/pane.

The selected capability renders contextual content into that experience if the actual API supports this.

The amendment must document the desired contract for a capability view slot.

However, do NOT claim that cross-plugin rendering into the Navigator's pane is supported until verified.

Required implementation spike:

Determine whether a capability Mod can render into a Navigator-owned pane through the actual hook / `next(e)` / UI composition mechanism.

If supported:

- define the view-slot contract.

If unsupported:

- use one capability pane at a time;
- Navigator opens/closes it;
- only one capability view remains active.

Do not implement either approach now.

---

# 39. API verification spikes

The amended specifications must explicitly list the following unresolved implementation questions.

## Spike A — View slot

Can a capability Mod render into a Navigator-owned pane?

Verify using the actual API.

---

## Spike B — Hook ordering

Can a capability reliably observe another Mod's `state.set` change?

Verify post-write ordering.

If not guaranteed:

use re-derive fallback at turn completion.

---

## Spike C — Spec-Kit interception

Verify whether `/speckit.*` commands arrive at:

```text
prompt.submit
```

as raw command text.

If not:

use an explicit:

```text
/sdd-run <phase>
```

mechanism.

---

## Spike D — Input

Verify whether terminal Input is multiline.

Do not assume.

---

## Spike E — Esc

Verify whether `ui.close` can refuse/intercept a close.

If not:

Esc closes the Navigator and `b` provides Back.

---

## Spike F — command.run

Verify whether:

```text
$.command.run
```

can invoke another plugin's registered command.

If not:

do not specify cross-plugin command invocation as guaranteed.

---

# 40. No invented API rule

Whenever a requirement references an API:

Check it against the actual local API.

If unsupported:

- mark it unsupported;
- provide a supported fallback;
- record an implementation spike if appropriate.

Never turn an imagined API into a specification requirement.

---

# 41. Capability independence

Each capability must remain independently meaningful if the Navigator is unavailable.

This means each capability should retain:

- its domain purpose;
- its command fallback;
- its state ownership;
- its contracts;
- its validation rules.

But it must not create a competing permanent Navigator.

---

# 42. File-specific amendments

Apply the following exact intent.

## 00-sdd-navigator.md

Add:

- view-slot contract;
- final hotkeys;
- `0`, `p`, `b`;
- Esc behavior;
- UI responsibility matrix;
- contract references;
- Prompt Pack resolution;
- capability availability behavior;
- single status-line ownership.

Preserve existing Navigator requirements unless contradicted by verified API behavior.

---

## 01-phase-tracker.md

Change:

- phase derived from 05 artifact inventory;
- remove independent artifact discovery;
- remove standalone persistent UI;
- remove duplicate navigation.

Keep:

- `/sdd-status`.

Make it a Navigator-compatible status/alias entry.

---

## 02-prompt-manager.md

Add:

- ⑪ Prompt Pack catalog;
- ownership of prompt edit;
- ownership of prompt reset;
- ownership of prompt save;
- `promptResolution`.

02 is the UI owner for ⑪.

---

## 03-prompt-review-gate.md

Make 03 the sole interceptor.

Add:

- re-entry guard;
- plugin origin protection;
- drop reason;
- 06 gate check;
- `$.ui.ask` fallback;
- Constitution phase;
- Edit fallback.

---

## 04-analyze-gate.md

Remove:

- Continue;
- Edit Prompt.

Add:

- read-only `tool.call` guard;
- AnalyzeResult contract;
- delegation through 03;
- semantic analysis ownership.

---

## 05-artifact-tracker.md

Make 05 the canonical artifact inventory owner.

Add:

- inventory contract;
- project-scoped persistence;
- freshness derivation.

Do not create an independent `staleArtifacts` state.

---

## 06-quality-gate.md

Make 06 the sole owner of:

- Approve;
- Reject;
- Continue.

Remove default/invented quality score behavior.

Consume:

04 Analyze  
05 Artifacts  
07 Trace

---

## 07-traceability.md

Remove:

- prompt editing.

Make 07 the sole owner of:

- deterministic ID graph;
- traceability links;
- orphan/gap logic.

Make its UI contextual.

---

## 08-convergence-tracker.md

Make 08 consume evidence.

Change:

```text
re-run Analyze
```

to:

```text
request re-analyze
```

Keep:

- Review;
- Mark exception.

---

## 09-session-history.md

Make 09 an observer.

Use:

- `state.set` observation where supported;
- re-derive fallback.

Use bounded project-keyed persistence.

---

## 10-sdd-control-plane-integration.md

Transform 10 into:

- aggregate view;
- `nextAction` derivation;
- configuration editor;
- event-flow documentation.

Remove orchestration ownership.

10 must not intercept phases.

10 must not own approval.

10 must not duplicate the capability workflow.

10 delegates.

---

## 11-default-sdd-prompt-pack.md

Declare:

```text
CONTENT ONLY
```

Remove unused UI.

Do not add Navigator ownership.

Content is surfaced by 02.

---

# 43. Fourteen-section skeleton

Every capability specification 01–11 must converge on a consistent 14-section structure.

Preserve the original requirements under the appropriate headings.

Do not throw away existing requirements merely to make the documents shorter.

When a requirement is removed because ownership moved:

record the reason explicitly.

Do not silently delete it.

The 14 sections should cover, as appropriate:

1. Purpose
2. Scope
3. Inputs
4. Outputs
5. State
6. Contracts
7. Dependencies
8. UI
9. Commands
10. Actions
11. Approval / Safety
12. Persistence
13. Failure / Unavailable Behavior
14. Acceptance / Implementation Readiness

If the existing specifications use different exact section names, preserve their useful structure while converging semantically on these responsibilities.

---

# 44. Original requirements preservation

For every file:

- retain valid original requirements;
- move requirements when ownership changes;
- remove only genuine contradictions;
- record every removed/replaced responsibility;
- do not simplify away important acceptance criteria;
- do not weaken safety/approval rules.

Create a "Changed Ownership / Removed Responsibility" subsection if needed.

---

# 45. Dependency rules

Hard dependencies:

```text
02 -> 11
03 -> 02
01 -> 05
```

Soft/optional dependencies:

everything else

Use "unavailable" behavior when an optional dependency is absent.

No capability may assume every other capability is installed.

---

# 46. Acceptance requirements

The amended specification set must satisfy:

## Architecture

- One Navigator.
- Eleven capabilities.
- No duplicate navigation.
- No competing permanent dashboards.
- Control Plane is aggregate.
- Prompt Pack is content-only.

## Ownership

- Each state noun has one owner.
- Each action has one authority.
- Each artifact inventory has one owner.
- Each approval gate has one owner.
- Prompt editing has one owner.

## Safety

- Human approval cannot be bypassed.
- Analyze requests cannot silently become Analyze execution.
- Convergence cannot directly re-run Analyze.
- Control Plane cannot independently approve or execute.

## UI

- Contextual views.
- Pointer/button operation.
- Focus-scoped hotkeys.
- Slash-command fallbacks.
- Explicit Back behavior.
- Explicit Esc behavior.

## Persistence

- No incorrect claim that `$.store` is project-scoped.
- Project data goes to `.speckit/mod/`.
- History is bounded.

## API

- No unsupported API assumptions.
- All unresolved API behavior is recorded as a spike.
- Actual local API is authoritative.

---

# 47. Implementation-readiness classification

After amendment, classify each specification as:

```text
READY
READY WITH CAVEATS
NOT READY
```

Use:

READY

only if the specification is internally consistent and its required API behavior is verified.

Use:

READY WITH CAVEATS

when implementation is clear but one or more explicit API spikes remain.

Use:

NOT READY

only when an unresolved issue prevents a coherent implementation plan.

Do not mark something NOT READY merely because a future spike is desirable.

---

# 48. Expected readiness

The expected outcome is:

```text
00  READY WITH CAVEATS
01  READY WITH CAVEATS
02  READY WITH CAVEATS
03  READY WITH CAVEATS
04  READY WITH CAVEATS
05  READY WITH CAVEATS
06  READY WITH CAVEATS
07  READY WITH CAVEATS
08  READY WITH CAVEATS
09  READY WITH CAVEATS
10  READY WITH CAVEATS
11  READY WITH CAVEATS
```

Do not force these classifications.

If actual analysis proves a different classification, report the evidence.

---

# 49. Mandatory approval gate

Follow this sequence exactly.

### Step 1

Read all twelve specs.

### Step 2

Inspect the local API.

### Step 3

Build the ownership matrix.

### Step 4

Build the state contract matrix.

### Step 5

Build the dependency graph.

### Step 6

Identify contradictions.

### Step 7

Prepare the amendment plan.

### Step 8

STOP.

Do not modify any file until the user explicitly approves the amendment plan.

The approval question must be exactly:

```text
Approve the amendment plan? [Yes / No]
```

---

# 50. After explicit approval

Only after explicit approval:

1. Amend 00–11.
2. Preserve valid original requirements.
3. Apply the ownership changes above.
4. Apply the API constraints above.
5. Record unresolved implementation spikes.
6. Re-read every amended file.
7. Run a consistency pass across all twelve.
8. Check for:
   - duplicate ownership;
   - duplicate UI;
   - duplicate commands;
   - conflicting state contracts;
   - dependency cycles;
   - approval bypasses;
   - unsupported APIs;
   - inconsistent phase lists;
   - inconsistent terminology.
9. Fix specification-level inconsistencies.
10. Do NOT implement the Mods.

---

# 51. Mandatory final report

After the amendment is complete, report:

## A. Files changed

List all changed files.

## B. Change summary

One concise summary for each file 00–11.

## C. Architecture

Describe the final architecture.

## D. Ownership

Provide:

- state owner;
- UI owner;
- action owner;
- gate owner;
- persistence owner.

## E. Shared state

Show every shared noun with:

- owner;
- consumers;
- shape;
- persistence;
- failure behavior.

## F. Dependency graph

Show hard and soft dependencies.

## G. UI matrix

Show Navigator entry, UI owner, persistent/contextual state, and actions.

## H. Approval flow

Explain:

```text
prompt
  -> review
  -> approval
  -> execution
```

and all delegated paths.

## I. API compatibility

List:

- verified;
- unsupported;
- uncertain;
- fallback.

## J. Implementation spikes

List every unresolved API question.

## K. Readiness

Classify 00–11 as:

READY  
READY WITH CAVEATS  
NOT READY

## L. Removed/reassigned responsibilities

Explicitly list what moved from one Mod to another and why.

---

# 52. Strict prohibitions

During this task DO NOT:

- implement TypeScript;
- implement JavaScript;
- implement JSX;
- create hooks;
- create `plugin.json`;
- create `hooks.json`;
- create tests;
- install anything;
- modify Claude settings;
- modify user configuration;
- modify project source code;
- delete unrelated files;
- introduce Cursor;
- introduce an external orchestrator;
- introduce Rust;
- introduce a separate orchestration platform;
- invent APIs;
- invent Claude Code UI capabilities;
- create a separate `sdd-contracts` plugin;
- bypass human approval;
- turn Control Plane into an orchestration engine.

This task concerns ONLY:

Claude Code Mods  
+ Claude Code terminal/UI behavior  
+ GitHub Spec-Kit / SDD  
+ the twelve Markdown specifications.

---

# 53. Final architectural principle

The final system must represent:

**ONE SDD SYSTEM**

with:

**ONE NAVIGATOR**

and:

**ELEVEN MODULAR CAPABILITIES.**

The Navigator is the entry point.

The capabilities own their domains.

The Control Plane aggregates.

The Prompt Pack supplies content.

The Review Gate controls execution authorization.

The Quality Gate owns approval/rejection/continue.

The Artifact Tracker owns artifact truth.

The Traceability Mod owns deterministic requirement linkage.

The Analyze Mod owns semantic analysis.

The Convergence Mod consumes evidence and requests re-analysis through the proper gate.

The Session History Mod observes and records.

No Mod silently becomes another Mod.

No Mod creates a competing system.

No UI action bypasses the appropriate approval boundary.

No API is assumed without verification.

No implementation is performed during this amendment task.

---

# END OF PROMPT
