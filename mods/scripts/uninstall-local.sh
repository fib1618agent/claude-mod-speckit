#!/usr/bin/env bash
# Remove all SDD Mods installed by install-local.sh.
set -euo pipefail
mods="$(cd "$(dirname "$0")/.." && pwd)"
mkt="$HOME/.claude/local-mods"
for d in "$mods"/[01]*/; do
  d="${d%/}"; n="$(basename "$d")"
  name="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['name'])" "$d/.claude-plugin/plugin.json")"
  claude plugin uninstall "$name@claude-mods-local" --scope user || true
  rm -rf "$mkt/$n"
  python3 - "$mkt" "$name" <<'PY'
import json, sys
mkt, name = sys.argv[1:]; f = f"{mkt}/.claude-plugin/marketplace.json"; m = json.load(open(f))
m["plugins"] = [x for x in m["plugins"] if x["name"] != name]
json.dump(m, open(f, "w"), indent=2); open(f, "a").write("\n")
PY
done
