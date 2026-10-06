#!/usr/bin/env bash
# Install (or update) all 12 SDD Mods globally via the claude-mods-local directory marketplace.
# Copies each plugin into ~/.claude/local-mods/, registers it in marketplace.json, installs it at user scope.
# WARNING: user scope enables the Review Gate (03) in EVERY project. Undo: scripts/uninstall-local.sh
set -euo pipefail
mods="$(cd "$(dirname "$0")/.." && pwd)"
mkt="$HOME/.claude/local-mods"
cp "$mkt/.claude-plugin/marketplace.json" "$mkt/.claude-plugin/marketplace.json.bak"
for d in "$mods"/[01]*/; do
  d="${d%/}"; n="$(basename "$d")"
  rm -rf "$mkt/$n"; mkdir -p "$mkt/$n"
  rsync -a --exclude node_modules --exclude tests --exclude '.claude-plugin/types' "$d/" "$mkt/$n/"
  python3 - "$mkt" "$n" "$d/.claude-plugin/plugin.json" <<'PY'
import json, sys
mkt, n, pj = sys.argv[1:]
p = json.load(open(pj)); f = f"{mkt}/.claude-plugin/marketplace.json"; m = json.load(open(f))
m["plugins"] = [x for x in m["plugins"] if x["name"] != p["name"]]
m["plugins"].append({"name": p["name"], "source": f"./{n}", "description": p["description"]})
json.dump(m, open(f, "w"), indent=2); open(f, "a").write("\n")
PY
done
claude plugin marketplace update claude-mods-local
for d in "$mods"/[01]*/; do
  name="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['name'])" "${d%/}/.claude-plugin/plugin.json")"
  claude plugin install "$name@claude-mods-local" --scope user
done
