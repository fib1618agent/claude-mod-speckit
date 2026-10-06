# SDD Quality Gate (`sdd-quality-gate`)

The Quality Gate computes a gate per phase from evidence published by the other Mods (artifacts, Analyze result, traceability, convergence) and reports each as ready, not ready or blocked. It is the sole owner of Approve, Reject and Continue. `/sdd-quality [phase]` shows gates; `approve`, `reject` and `continue` record your decision after a confirmation question. There is no invented quality score, and an unanswerable confirmation fails closed. Whether Analyze must come before implement is configurable.

**Reads:** `.speckit/mod/config.yaml` (`quality` section), `.claude/skills` and `.claude/commands` names, and state from the artifact, analyze, trace and convergence Mods.

**Stores:** your approval decisions, project-keyed, in the per-user plugin store (`approvals:<project fingerprint>`), plus the computed gates as in-session state.

**Sends:** nothing.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
