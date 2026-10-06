#!/usr/bin/env bash
# Launch Claude Code with all 12 SDD Mods loaded for this session only (nothing is installed).
# Run from a Spec-Kit project. Extra args pass through: sdd-claude.sh --resume
set -euo pipefail
mods="$(cd "$(dirname "$0")/.." && pwd)"
args=()
for d in "$mods"/[01]*/; do args+=(--plugin-dir "${d%/}"); done
exec claude "${args[@]}" "$@"
