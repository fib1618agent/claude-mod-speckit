# SDD Traceability (`sdd-traceability`)

Traceability builds a deterministic graph of requirement IDs (for example `FR-001`) across the spec, plan, tasks, tests and implementation, and reports a trace matrix, gaps (a requirement with no downstream coverage) and orphans (an ID that does not trace to a requirement). The result is computed by pattern matching, not by a model. `/sdd-trace` prints it and `refresh` recomputes. Without the Artifact Tracker it reports a degraded state because it cannot locate the sources.

**Reads:** the spec, plan and tasks files located through the Artifact Tracker, and test and implementation files in directories you list in the `trace` section of `.speckit/mod/config.yaml` (at most 200 files per directory; large files are skipped).

**Stores:** the trace result as in-session state only. Nothing is written to disk or the per-user store.

**Sends:** nothing.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
