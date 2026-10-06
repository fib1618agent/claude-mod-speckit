# SDD Prompt Review Gate (`sdd-prompt-review`)

The Review Gate is the sole interceptor of Spec-Kit phase runs and the human approval step before them. When you type a `/speckit-*` command or run `/sdd-run <phase>`, it holds the run, asks the Prompt Manager for the composed prompt, shows it, and offers Run, Edit or Cancel. Nothing runs without your approval: unknown, missing or unanswerable approval fails closed. The approval-class `/sdd-review` subcommands (`run`, `edit`, `cancel`, `save`) need a human origin. Run is blocked while the Quality Gate reports a blocked phase.

**Reads:** `.speckit/mod/config.yaml` (`review` and `phase` sections), `.claude/skills` and `.claude/commands` names, and the prompt resolution from `sdd-prompt-manager`.

**Stores:** the pending review (phase, prompt hash, state) as in-session state. Nothing is written to disk or the per-user store.

**Sends:** after you approve, the reviewed prompt text is submitted to Claude as your prompt for that turn, exactly as if you had typed it. Nothing is sent before approval. It intercepts `/speckit-*` in every project where it is installed at user scope; install with `--scope project` to limit it.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
