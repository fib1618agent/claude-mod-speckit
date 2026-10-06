# SDD Phase Tracker (`sdd-phase-tracker`)

The Phase Tracker works out which Spec-Kit phase the project is in (for example specify, plan, tasks or implement), how far along it is and which phases come next. The phase is derived from the artifact inventory kept by the Artifact Tracker, never guessed from chat. `/sdd-status` shows it as text, or opens the Navigator Phase view when that Mod is installed; `/sdd-status refresh` recomputes and `reset` clears the derived state after asking you to confirm.

**Reads:** `.speckit/mod/config.yaml` (optional `phase` section), the names of skills and commands under `.claude/skills` and `.claude/commands`, and the artifact inventory state from `sdd-artifact-tracker`.

**Stores:** the derived phase as in-session state. Nothing is written to disk or to the per-user store.

**Sends:** nothing. It may ask a Yes/No confirmation before `reset`.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
