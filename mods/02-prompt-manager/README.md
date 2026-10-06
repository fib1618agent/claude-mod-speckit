# SDD Prompt Manager (`sdd-prompt-manager`)

The Prompt Manager owns the prompt templates for each Spec-Kit phase. It composes layers in a fixed, visible order (Spec-Kit base instructions, project policy, the project template, repository context, feature artifacts, your arguments, one-time instructions) and publishes the result as `promptResolution`. `/sdd-prompt` shows, edits, saves, resets and seeds templates. It is the only Mod that edits or saves templates; the Review Gate asks it to resolve a prompt before approval.

**Reads:** `.speckit/mod/config.yaml` (`prompt` section), `.speckit/mod/policy.md`, project templates in `.speckit/mod/prompts/<phase>.md`, the `pack.json` and templates of an installed Prompt Pack, and `.claude/skills` and `.claude/commands` names.

**Stores:** writes only inside the project `.speckit/mod/` tree (refused anywhere else, including through a symlinked `.speckit`), and only after you confirm: `save` writes a template, `seed` copies Pack templates without overwriting existing files, `reset` removes your edit. The resolved prompt is kept as in-session state.

**Sends:** nothing by itself. Edited text is placed in your prompt box (`$.prompt.fill`) for you to review.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
