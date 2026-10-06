# SDD Analyze Gate (`sdd-analyze-gate`)

The Analyze Gate records the result of a Spec-Kit Analyze pass as structured findings grouped by severity (BLOCKER, HIGH, MEDIUM, LOW) with coverage and staleness. `/sdd-analyze` shows the last result; `/sdd-analyze run` requests a read-only Analyze, which is executed through the Review Gate so you still approve it. While that Analyze turn runs, a best-effort guard denies file-modifying tool calls and tells Claude to report the finding instead.

**Reads:** the Analyze turn output (it parses the `sdd-findings` report; an unparseable report is recorded as UNKNOWN, never as ready), prompts submitted by other plugins, tool calls during the Analyze turn, and artifact state for staleness.

**Stores:** the latest Analyze result, project-keyed, in the per-user plugin store (`analyze:<project fingerprint>`), plus in-session state.

**Sends:** nothing itself; it delegates the run to `/sdd-run analyze`.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
