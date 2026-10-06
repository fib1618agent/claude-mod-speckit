# SDD Convergence Tracker (`sdd-convergence-tracker`)

The Convergence Tracker reports whether the work is converging, based on evidence: task completion in `tasks.md`, the Analyze result, traceability and the artifact state. States include not started and converged; if `tasks.md` is unreadable it reports not started, never converged. It also detects regressions. `/sdd-converge` shows the state, `/sdd-converge run` requests a re-analysis through the Review Gate, and `/sdd-converge except <scope> <reason>` records an exception after you confirm.

**Reads:** `tasks.md` (located through the Artifact Tracker) and the artifact, analyze, quality and trace state of the other Mods.

**Stores:** your recorded exceptions, project-keyed, in the per-user plugin store; the computed convergence state is in-session only.

**Sends:** nothing itself; re-analysis is delegated to `/sdd-run analyze`, which you approve.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
