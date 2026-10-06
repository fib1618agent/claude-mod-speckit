# SDD Navigator (`sdd-navigator`)

The Navigator is the user interface shell for the SDD Mods. `/sdd [view]` opens a pane with a navigation row, a slot that embeds the views drawn by the other Mods, Back and Close controls, and the single status line that shows the current phase. It contains no business logic. If an embedded view fails to appear it falls back to showing one pane at a time. Hotkeys work only while the pane has focus: `1`–`9`, `0` and `p` open views, `b` goes back, `Esc` closes.

**Reads:** the optional `navigator` section of `.speckit/mod/config.yaml` (display mode), and the phase, convergence and control state published by the other SDD Mods.

**Stores:** only in-session state (which view is open). Nothing is written to disk and nothing is kept in the per-user store.

**Sends:** nothing; it only draws UI and sets the status line.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
