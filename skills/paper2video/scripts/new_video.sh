#!/usr/bin/env bash
# Start a new video folder in this workspace, wired to the shared dependencies.
#   ./new_video.sh "<Short name> video"        e.g.  ./new_video.sh "LoRA Survey video"
# Creates the folder from the paper2video skill template (Remotion starter + pipeline scripts), links node_modules and
# .env to the workspace root, and writes a CLAUDE.md skeleton. Then open Claude Code in that folder and give it the
# paper (arXiv link or title); the workspace CLAUDE.md (this folder) applies to every video automatically.
set -euo pipefail
cd "$(dirname "$0")"
NAME=${1:?usage: ./new_video.sh "<Short name> video"}
SKILL="${PAPER2VIDEO_SKILL:-$HOME/.claude/skills/paper2video}"
[[ -d "$SKILL/template" ]] || { echo "skill not found at $SKILL (install it: cp -r paper2video/skills/paper2video ~/.claude/skills/)"; exit 1; }
[[ -e "$NAME" ]] && { echo "already exists: $NAME"; exit 1; }
[[ -d node_modules ]] || { echo "shared node_modules missing: run 'npm ci' in $(pwd) first"; exit 1; }

mkdir -p "$NAME"
cp -R "$SKILL/template/." "$NAME/"
cp -R "$SKILL/scripts" "$NAME/scripts"
rm -rf "$NAME/scripts/__pycache__"
cd "$NAME"
ln -s ../node_modules node_modules
[[ -f ../.env ]] && ln -s ../.env .env
mkdir -p notes data out public/data
mv README.md notes/template_README.md  # the template guide; keep the folder root for this video's files
SLUG=$(echo "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
python3 - "$SLUG" <<'EOF'
import json, pathlib, sys
root = json.loads(pathlib.Path("../package.json").read_text())
pj = {"name": sys.argv[1] or "paper-video", "private": True,
      "//": "Dependencies are installed once in the workspace root (../package.json); node_modules here is a link to ../node_modules.",
      "scripts": {"dev": "remotion studio", "build": "remotion bundle", "lint": "eslint src && tsc"},
      "dependencies": root["dependencies"], "devDependencies": root["devDependencies"]}
pathlib.Path("package.json").write_text(json.dumps(pj, indent=2, ensure_ascii=False) + "\n")
pathlib.Path("package.additions.json").unlink(missing_ok=True)
EOF
cat > CLAUDE.md <<EOF
# $NAME

Made with the \`paper2video\` skill. Workspace rules: ../CLAUDE.md (they apply here too).

## Goal
- Paper: <title, arXiv id, version used as source of truth>
- Whose work: <ours → first person | someone else's → third person, unofficial explainer>

## Sources
- <PDF / LaTeX source / code / project page / data>

## Log
- $(date +%Y-%m-%d): folder created with new_video.sh
EOF
npx tsc --noEmit >/dev/null 2>&1 && echo "type-check ok" || echo "type-check: run 'npx tsc --noEmit' to see issues"
echo "created: $(pwd)"
