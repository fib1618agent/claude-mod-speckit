# SDD Session History (`sdd-session-history`)

Session History keeps a bounded, project-keyed timeline of SDD actions: phase changes, reviews, Analyze runs, artifact changes, gate changes, traceability and convergence changes. It is an observer: it watches the other Mods state updates and writes only its own record. `/sdd-history` shows the last entries, `phase <phase>` filters, and `clear` deletes the history after confirmation. Each entry holds a kind, time, phase and short summary. It never records prompts, source text, secrets or finding evidence, only a short hash of a reviewed prompt.

**Reads:** state published by the SDD Mods and the optional `history` section of `.speckit/mod/config.yaml` (`enabled`, `maxEntries`, default 200).

**Stores:** the history list, project-keyed, in the per-user plugin store (`history:<project fingerprint>`), oldest entries dropped past the limit.

**Sends:** nothing.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
