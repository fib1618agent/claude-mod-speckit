# SDD Control Plane (`sdd-control-plane`)

The Control Plane is an aggregate view in the Navigator. It reads the state of the other Mods, derives a single `nextAction` suggestion, and shows the configuration view for `.speckit/mod/config.yaml`. It owns no approval and runs nothing itself: its buttons delegate to the Mod that owns the action, such as the Review Gate or Quality Gate. It has no slash command; open it from `/sdd`. It is not an orchestration engine.

**Reads:** state from all other SDD Mods and `.speckit/mod/config.yaml`.

**Stores:** the aggregate as in-session state. The only file it writes is `.speckit/mod/config.yaml`, when you choose to save a configuration you edited in the prompt box and confirm the question. Each Mod validates only its own section.

**Sends:** nothing; it places the config text in your prompt box for you to edit.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
