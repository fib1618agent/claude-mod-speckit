# AMEND-SPECKIT-MODS.md

## Purpose

Amend the existing GitHub Spec-Kit / SDD Claude Code Mod specifications in this folder so they work as one coherent system with `00-sdd-navigator.md` as the shared UI shell.

**This task is specification amendment only. Do NOT implement the Mods yet.**

The final result should be a coordinated set of implementation-ready Markdown specifications.

---

# 1. Scope

Work ONLY on:

- Claude Code Mods
- Claude Code terminal UI
- GitHub Spec-Kit / Spec-Driven Development
- the Markdown specifications in this folder

Do NOT introduce:

- Cursor
- Rust
- external orchestration
- web dashboards
- desktop applications
- replacement implementations of Spec-Kit

Do not modify Spec-Kit itself.

---

# 2. Files to Inspect

Read all of these before making any amendment:

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

If additional Markdown files in this folder are clearly part of the SDD Mod specification set, inspect them too and report them.

Do not assume the contents of any file. Read them.

---

# 3. Authority: Current Claude Code Mod API

Before amending the specifications, inspect the current official Claude Code Mods implementation/API and examples.

Use official Anthropic Claude Code source/docs as the authority.

The current Mods implementation is based on function-hook plugins. Official source documents the Mod structure, TypeScript contracts, tests, UI capabilities, and composition of Mods through shared noun contracts.

Important: the Mods API is early access and may change between Claude Code releases.

Therefore:

- do not invent APIs;
- do not preserve an old API assumption merely because it appears in an existing prompt;
- explicitly flag unsupported or uncertain behavior;
- use the current installed Claude Code API/version where possible;
- prefer APIs demonstrated in the official source.

---

# 4. Core Architectural Change

The new architecture is:

```text
                         Claude Code
                              |
                              v
                    +--------------------+
                    |   SDD NAVIGATOR    |
                    |    UI SHELL        |
                    +---------+----------+
                              |
                       shared SDD state
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
     Phase Tracker       Prompt Manager      Analyze Gate
          |                   |                   |
          +-------------------+-------------------+
                              |
                        other SDD Mods
```

`00-sdd-navigator.md` is the shared UI shell.

The other 11 files describe capability Mods.

The Navigator owns:

- navigation;
- selection;
- active capability view;
- shared navigation behavior;
- keyboard/pointer interaction;
- open/close behavior;
- common UI conventions.

Each capability Mod owns:

- its domain logic;
- its analysis;
- its validation;
- its findings;
- its capability-specific state;
- its capability-specific actions.

Do NOT move all business logic into the Navigator.

---

# 5. Mandatory Amendment Rules for All 11 Capability Specs

For every capability specification:

## 5.1 Remove permanent standalone UI assumptions

The capability must NOT assume it owns a permanent large terminal panel.

Instead:

```text
SDD Navigator
      |
      +--> Capability selected
                |
                v
          Capability UI
```

The capability UI is contextual.

## 5.2 Navigator-aware entry

Each capability specification must explicitly define:

- how it is opened by the Navigator;
- what state it receives;
- what UI it renders;
- what actions it exposes;
- how it returns to the Navigator;
- what happens if it is unavailable.

## 5.3 No duplicate navigation

The capability must not implement another:

```text
Phase | Prompt | Review | Analyze | ...
```

navigation row.

Only the Navigator owns that.

## 5.4 No global shortcut conflicts

Capability Mods must not claim global keyboard shortcuts that conflict with the Navigator or normal Claude Code.

Use scoped/focused interaction supported by the current API.

## 5.5 Preserve human approval

The Navigator must never bypass approval gates defined by the capability.

For example:

```text
Navigator
   |
   v
Analyze
   |
   v
Review Prompt
   |
   v
User Approval
   |
   v
Run Analyze
```

## 5.6 Capability must remain independently meaningful

A capability should still have valid behavior if the Navigator is unavailable.

Do not make the capability's domain logic depend on the Navigator.

The Navigator is the UI entry point, not the business-logic owner.

---

# 6. Shared State / Contracts

Review all 11 specs and identify state that must be shared.

Candidate state:

```text
currentPhase
activeView
artifactStatus
qualityStatus
traceabilityStatus
convergenceStatus
lastAnalyzeResult
lastAction
staleArtifacts
blockingFindings
```

Do NOT blindly adopt this list.

Determine the minimum correct shared contract from the actual specifications.

For each shared state item document:

- owner;
- producer;
- consumers;
- type/shape;
- lifecycle;
- persistence requirements;
- event/update mechanism;
- failure behavior.

Prefer the current Claude Code Mods composition mechanism and typed noun contracts where appropriate.

Do not duplicate type declarations across Mods if a shared contract is appropriate.

---

# 7. Capability Mapping

Ensure the amended specifications map cleanly:

```text
1  Phase       -> 01 Phase Tracker
2  Prompt      -> 02 Prompt Manager
3  Review      -> 03 Prompt Review Gate
4  Analyze     -> 04 Analyze Gate
5  Artifacts   -> 05 Artifact Tracker
6  Quality     -> 06 Quality Gate
7  Trace       -> 07 Requirement Traceability
8  Converge    -> 08 Convergence Tracker
9  History     -> 09 Session History
10 Control     -> 10 SDD Control Plane
11 Prompts     -> 11 Default SDD Prompt Pack
```

If any mapping is architecturally wrong, report it before changing it.

---

# 8. UI Responsibility Matrix

Create a matrix across all Mods.

Example:

| Mod | Owns UI | Navigator Entry | Persistent UI | Contextual UI | Actions |
|---|---|---|---|---|---|
| Phase Tracker | Phase details | Yes | Compact status only | Yes | ... |
| Prompt Manager | Prompt details | Yes | No | Yes | ... |
| Analyze Gate | Analysis | Yes | No | Yes | ... |

Complete the real matrix based on the specifications.

No capability should accidentally own UI belonging to another capability.

---

# 9. Navigator Interaction Contract

Every capability specification must document this lifecycle:

```text
Normal Claude Code
       |
       v
SDD Navigator
       |
       v
Capability
       |
       +---- action
       |
       +---- close/back
       |
       v
SDD Navigator
       |
       v
Normal Claude Code
```

If the current Claude Code API does not support a requested interaction exactly, document the supported fallback.

Do not invent an implementation.

---

# 10. Keyboard and Mouse Contract

The Navigator is the owner of navigation-level interaction.

Preferred conceptual shortcuts:

```text
1  Phase
2  Prompt
3  Review
4  Analyze
5  Artifacts
6  Quality
7  Trace
8  Converge
9  History
0  Control
P  Prompts
Esc Close
```

However, **do not assume these are safe global shortcuts**.

Verify against the current Claude Code Mod API.

Capability specs should define only capability-local interaction where needed.

Mouse/pointer interaction should use actual supported UI controls.

---

# 11. Persistent vs Contextual UI

Amend the specs to follow:

### Persistent

Only compact shared SDD information, if supported:

```text
SDD | PLAN | Gate ✓ | 4/9 | Quality 91%
```

### Contextual

Detailed capability views:

- Prompt Review
- Analyze
- Quality Gate
- Traceability
- Artifact status
- Convergence
- History
- Control Plane

Do not create 11 large permanent panels.

---

# 12. Dependency Analysis

Build a dependency graph across the entire specification set.

Example:

```text
Default Prompt Pack
        |
        v
Prompt Manager
        |
        v
Prompt Review Gate
        |
        +----> Analyze Gate
        |
        +----> other Spec-Kit operations

Artifact Tracker
        |
        +----> Quality Gate
        |
        +----> Convergence Tracker
        |
        +----> Control Plane
```

The actual graph must be derived from the files.

Identify:

- dependencies;
- ordering;
- shared state;
- event flow;
- cycles;
- optional dependencies;
- hard dependencies.

Fix specification-level contradictions.

Do not implement fixes.

---

# 13. Control Plane Amendment

`10-sdd-control-plane-integration.md` must be treated carefully.

It should be the **aggregated SDD operational view**, not a second Navigator.

The Control Plane can consume state from the other Mods and show:

```text
Phase
Artifacts
Quality
Traceability
Analyze
Convergence
Next Action
```

But it must not duplicate the top-level navigation row.

---

# 14. Prompt Pack Amendment

`11-default-sdd-prompt-pack.md` is a prompt/content capability, not a permanent UI dashboard.

Its prompts should surface through:

```text
Prompt Manager
        |
        v
Prompt Review Gate
```

Do not give the Prompt Pack unnecessary independent UI.

---

# 15. Phase Tracker Amendment

`01-phase-tracker.md` should own:

- phase determination;
- phase progress;
- phase transitions;
- artifact-derived phase state.

It should not own the global Navigator.

Phase should be derived from actual project/artifact state where possible, not merely from which command the user last invoked.

---

# 16. Prompt Manager Amendment

`02-prompt-manager.md` should own:

- prompt templates;
- prompt versions;
- prompt composition;
- project-specific prompt configuration;
- prompt inspection/editing/reset behavior.

It should not own the global SDD navigation row.

---

# 17. Prompt Review Gate Amendment

`03-prompt-review-gate.md` should own:

- generated prompt presentation;
- review;
- edit;
- approval;
- cancellation.

It must remain a real human approval gate.

---

# 18. Analyze Gate Amendment

`04-analyze-gate.md` should remain read-only for analysis itself.

It owns:

- analysis execution;
- findings;
- coverage;
- read-only reporting;
- analysis result state.

It must not silently modify project artifacts unless the specification explicitly defines a separate approved action and the user approves it.

---

# 19. Artifact Tracker Amendment

`05-artifact-tracker.md` should own:

- artifact inventory;
- freshness;
- dependency/staleness relationships;
- invalidation state.

Its stale-artifact information can be consumed by Quality, Convergence, and Control Plane.

---

# 20. Quality Gate Amendment

`06-quality-gate.md` should own:

- quality checks;
- blocking conditions;
- warnings;
- pass/fail state;
- approval/continue decisions where applicable.

Do not duplicate analysis logic owned by Analyze Gate.

---

# 21. Traceability Amendment

`07-traceability.md` should own:

```text
Requirement
   |
   +-- Acceptance Criteria
   +-- Plan
   +-- Tasks
   +-- Tests
   +-- Implementation
```

Its UI is contextual/on-demand.

Do not make it a permanent dashboard.

---

# 22. Convergence Tracker Amendment

`08-convergence-tracker.md` should own:

- convergence state;
- regression detection;
- cross-artifact consistency;
- open/blocking items;
- stale dependencies.

It consumes state from other capabilities rather than duplicating their logic.

---

# 23. Session History Amendment

`09-session-history.md` should own:

- SDD action history;
- phase transitions;
- analysis runs;
- approvals;
- artifact changes relevant to SDD;
- convergence transitions.

It should remain primarily on-demand.

---

# 24. Implementation-Readiness

After amendments, every capability specification must be implementation-ready.

Each should clearly define:

1. Purpose
2. Scope
3. Events/hooks
4. State
5. Shared contracts
6. UI
7. Navigator integration
8. Commands/actions
9. Dependencies
10. Error handling
11. Security/safety
12. Testing
13. Acceptance criteria
14. Unsupported/uncertain API assumptions

Do not add speculative implementation details that cannot be supported by the current API.

---

# 25. Do Not Implement

This task is NOT implementation.

Do not:

- create TypeScript files;
- create plugin manifests;
- create hooks;
- create tests;
- modify source code;
- install plugins;
- modify Claude configuration;
- run destructive commands.

Only amend the Markdown specifications after analysis and approval.

---

# 26. Mandatory Review Before Editing

Before modifying any file, produce an internal amendment plan covering:

- every file that will change;
- why it changes;
- major changes;
- dependencies;
- risks;
- unresolved questions.

Then inspect the current API/source again if necessary.

---

# 27. Amendment Rules

When editing:

- preserve useful existing requirements;
- do not rewrite content merely for style;
- do not remove a requirement unless it conflicts with the Navigator architecture or current API;
- if removing/changing a requirement, record the reason;
- preserve user intent;
- maintain consistent terminology across all files;
- use `SDD Navigator` consistently;
- use `capability Mod` for the 11 functional Mods;
- use `UI shell` for the Navigator;
- avoid calling the Navigator a business-logic Mod;
- keep all specifications internally consistent.

---

# 28. Required Final Report

After completing the amendment pass, provide:

## Files Changed

```text
00-sdd-navigator.md    [unchanged / amended]
01-phase-tracker.md    [amended]
...
11-default-sdd-prompt-pack.md [amended]
```

## Change Summary

For every changed file:

```text
File:
Changes:
Reason:
Navigator integration:
Shared state:
API considerations:
```

## Architecture Summary

Show the final architecture diagram.

## Shared State Contract

Show the final shared contract.

## Dependency Graph

Show the final dependency graph.

## UI Responsibility Matrix

Show the final UI ownership matrix.

## Keyboard / Pointer Contract

Show the final interaction model.

## API Compatibility

List:

- confirmed supported capabilities;
- unsupported capabilities;
- uncertain capabilities;
- fallbacks.

## Implementation Readiness

Rate each specification:

```text
READY
READY WITH CAVEATS
NOT READY
```

Explain anything that is not READY.

---

# 29. Mandatory Approval Gate

After producing the amendment analysis and proposed changes:

**STOP.**

Ask:

```text
The SDD Mod specifications have been reviewed and an amendment plan is ready.

No files have been modified yet.

Approve the amendment plan? [Yes / No]
```

Do not modify any Markdown file until the user explicitly approves.

After approval:

1. Amend the files.
2. Re-read all amended files.
3. Perform a consistency pass across all 12 files.
4. Check Navigator/capability boundaries.
5. Check shared-state contracts.
6. Check dependencies.
7. Check API assumptions.
8. Report the final changes.

Do not implement the Mods during this task.

---

# 30. Final Principle

The goal is:

```text
                  Claude Code
                       |
                       v
               +---------------+
               | SDD Navigator |
               +-------+-------+
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
      Phase         Prompt          Analyze
        |              |              |
        +--------------+--------------+
                       |
                Other SDD Mods
                       |
                       v
                 GitHub Spec-Kit
```

The user experiences **one SDD system**.

The 11 Mods remain modular capabilities.

The Navigator is the single UI entry point.

Do not sacrifice modularity to achieve the unified UI.
