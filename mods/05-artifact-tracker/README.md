# SDD Artifact Tracker (`sdd-artifact-tracker`)

The Artifact Tracker builds the canonical inventory of Spec-Kit artifacts and decides when one is stale. It lists the constitution, and per feature the spec, plan, tasks, checklists and any configured implementation paths, with existence, size, modification time and a content hash. Other Mods read this inventory instead of scanning files themselves. `/sdd-artifacts` prints it; `refresh` rescans. If there is no `.specify` directory it reports that the project is not a Spec-Kit project.

**Reads:** `.specify/` (including `memory/constitution.md`), `specs/<feature>/` files and `checklists/`, configured implementation directories, and `.speckit/mod/config.yaml`. Files larger than a size limit are fingerprinted by size and modification time instead of content.

**Stores:** the last-seen hash of each artifact, project-keyed, in the per-user plugin store (`hashes:<project fingerprint>`); hashes only, never file contents. The inventory is also kept as in-session state.

**Sends:** nothing. It never writes to your project files.

**Network and processes:** none. This Mod makes no network requests and starts no subprocesses; all work happens in the Claude Code session on local files.

**Requirements:** Claude Code with Mods support (2.1.289 verified) and a [Spec-Kit](https://github.com/github/spec-kit) project. It is one of twelve SDD Mods; each works alone through its text command, and `sdd-navigator` adds the `/sdd` pane. Install and overview: [repository README](https://github.com/fib1618agent/claude-mod-speckit#readme).
