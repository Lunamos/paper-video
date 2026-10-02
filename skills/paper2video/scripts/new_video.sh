#!/usr/bin/env bash
# Start a new video folder in a workspace, wired to the shared dependencies.
#   ./new_video.sh <ShortName>        e.g.  ./new_video.sh LoRA   ->  995_LoRA/
# Folder names are <NNN>_<ShortName> with NNN counting DOWN from 999 (next = smallest existing - 1), so sorting by name
# (Finder, ls) lists the video folders first, newest on top. File names inside use the slug = lower-case short name.
# Creates the folder from the paper2video skill template (Remotion starter + pipeline scripts), links node_modules and
# .env to the workspace root, writes a CLAUDE.md skeleton and a .gitignore. Then open Claude Code in that folder and give
# it the paper (arXiv link or title); the workspace CLAUDE.md (this folder) applies to every video automatically.
# Copy this script to the workspace root, next to the shared package.json.
set -euo pipefail
cd "$(dirname "$0")"
SHORT=$(echo "${1:?usage: ./new_video.sh <ShortName>   (letters, digits, -)}" | tr ' ' '-' | tr -cd 'A-Za-z0-9-')
[[ -n "$SHORT" ]] || { echo "short name must contain letters or digits"; exit 1; }
SKILL="${PAPER2VIDEO_SKILL:-$HOME/.claude/skills/paper2video}"
[[ -d "$SKILL/template" ]] || { echo "skill not found at $SKILL (install it: cp -r paper2video/skills/paper2video ~/.claude/skills/)"; exit 1; }
[[ -d node_modules ]] || { echo "shared node_modules missing: run 'npm ci' in $(pwd) first"; exit 1; }
for d in [0-9][0-9][0-9]_*/; do
  [[ -d "$d" && "${d#*_}" == "$SHORT/" ]] && { echo "already exists: ${d%/}"; exit 1; }
done
LOWEST=$(ls -d [0-9][0-9][0-9]_*/ 2>/dev/null | cut -c1-3 | sort | head -1)
NUM=$(printf '%03d' $(( 10#${LOWEST:-1000} - 1 )))
(( 10#$NUM > 0 )) || { echo "numbers used up: renumber the folders first"; exit 1; }
NAME="${NUM}_${SHORT}"
SLUG=$(echo "$SHORT" | tr '[:upper:]' '[:lower:]')

mkdir -p "$NAME"
cp -R "$SKILL/template/." "$NAME/"
cp -R "$SKILL/scripts" "$NAME/scripts"
rm -rf "$NAME/scripts/__pycache__"
cd "$NAME"
ln -s ../node_modules node_modules
[[ -f ../.env ]] && ln -s ../.env .env
mkdir -p notes data out/covers public/data review
mv README.md notes/template_README.md  # the template guide; keep the folder root for this video's files
python3 - "$SLUG" <<'EOF'
import json, pathlib, sys
root = json.loads(pathlib.Path("../package.json").read_text())
pj = {"name": sys.argv[1], "private": True,
      "//": "Dependencies are installed once in the workspace root (../package.json); node_modules here is a link to ../node_modules.",
      "scripts": {"dev": "remotion studio", "build": "remotion bundle", "lint": "eslint src && tsc"},
      "dependencies": root["dependencies"], "devDependencies": root["devDependencies"]}
pathlib.Path("package.json").write_text(json.dumps(pj, indent=2, ensure_ascii=False) + "\n")
pathlib.Path("package.additions.json").unlink(missing_ok=True)
EOF
mv scenes.example.json social_copy.example.md notes/  # references: script schema, copy structure
cat > .gitignore <<'EOF'
# secrets
.env
.env.*
# raw material, caches, renders
data/
refs/
audio_cache/
out/
review/
node_modules/
.cache/
*.log
.DS_Store
.venv/
EOF
cat > CLAUDE.md <<EOF
# $NAME

Made with the \`paper2video\` skill. Workspace rules: ../CLAUDE.md (they apply here too). File layout and the fixed
names in \`out/\`: ../README.md. File slug: \`$SLUG\` (\`out/${SLUG}_zh.mp4\`, \`out/${SLUG}_en.mp4\`, \`out/${SLUG}_zh_vertical.mp4\`, \`out/covers/\`).

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
