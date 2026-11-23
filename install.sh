#!/usr/bin/env bash
# Installs (or updates) the agent harness into a project.
#   ./install.sh <target-dir> [--force]
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:?usage: ./install.sh <target-dir> [--force]}"
FORCE="${2:-}"

mkdir -p "$TARGET"
DST="$(cd "$TARGET" && pwd)"
[[ "$DST" == "$SRC" ]] && { echo "Target is the harness itself." >&2; exit 1; }

# Fixes made inside the project copy and not yet ported to the harness repository would be overwritten.
if [[ "$FORCE" != "--force" && -f "$DST/.specs/harness/incidents.jsonl" ]] && command -v node >/dev/null; then
  if ! node "$SRC/scripts/incident.mjs" pending-upstream --root "$DST"; then
    echo "Aborted: the fixes above were made in this project and not ported upstream." >&2
    echo "Port them to the harness, mark each with: node scripts/incident.mjs upstreamed --key <key>  (or re-run with --force)." >&2
    exit 3
  fi
fi

# Harness-owned folders: always refreshed. Project-local agents/skills with other names are kept.
for dir in rules agents skills templates hooks; do
  mkdir -p "$DST/.claude/$dir"
  cp -R "$SRC/.claude/$dir/." "$DST/.claude/$dir/"
done

mkdir -p "$DST/scripts"
for s in validate-harness.mjs validate-task.mjs incident.mjs task-diff.mjs gate.mjs; do cp "$SRC/scripts/$s" "$DST/scripts/$s"; done

# Project-owned files: never overwritten unless --force.
copy_owned() {
  if [[ "$FORCE" == "--force" || ! -e "$DST/$2" ]]; then cp "$SRC/$1" "$DST/$2"
  else echo "kept     $2 (exists; use --force to overwrite)"; fi
}
copy_owned ".claude/templates/settings.harness.json" ".claude/settings.json"
copy_owned "AGENTS.md" "AGENTS.md"

# CLAUDE.md: constitution part only; the project section starts empty.
if [[ "$FORCE" == "--force" || ! -e "$DST/CLAUDE.md" ]]; then
  awk '/^# Project[[:space:]]*$/ {exit} {print}' "$SRC/CLAUDE.md" > "$DST/CLAUDE.md"
  cat >> "$DST/CLAUDE.md" <<'EOF'
# Project

<!-- Project-specific. Filled in on the first task; correct what is wrong. -->

## What this is

## Commands
| Purpose | Command |
|---------|---------|
| Dev | |
| Test (scoped) | |
| Build | |

## Verification
Kind: <web | mobile | dashboard | pipeline | analysis | cli-lib | infra>

| Gate | Command | Baseline |
|------|---------|----------|

| Surface | Proves it | Command or step |
|---------|-----------|-----------------|

Delivered means:

## Conventions

## Standing instructions
<!-- Empty = solo default: gated work lands on the local main line, one commit per task; push asks once. Write "always push when green" to push without asking, or "collaboration mode" for branch + PR with layered commits. -->

## Context index

## Lessons learned
EOF
else
  echo "kept     CLAUDE.md (exists; rules still load from .claude/rules/)"
fi

mkdir -p "$DST/.specs/tasks" "$DST/.specs/docs" "$DST/.specs/logs"

touch "$DST/.gitignore"
for line in ".specs/logs/" "prototypes/**/node_modules/" ".taste-skill/"; do
  grep -qxF "$line" "$DST/.gitignore" || echo "$line" >> "$DST/.gitignore"
done

echo "Harness installed in $DST"
echo "Next: open the project in Claude Code and write what you want. Existing code is mapped on the first task, without questions."
