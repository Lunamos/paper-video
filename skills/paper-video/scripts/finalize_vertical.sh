#!/usr/bin/env bash
# Vertical cut (1080x1920: Shorts, Reels, Douyin, Xiaohongshu, Bilibili vertical) with the same
# -14 LUFS / -1.5 dBTP master as the landscape cuts, plus optional vertical cover stills.
#
# Usage: scripts/finalize_vertical.sh <VerticalCompositionId> [output-name] [CoverStillId ...]
#   e.g. scripts/finalize_vertical.sh VIDEO-Vertical video_zh_vertical Cover-ZH-3x4 Cover-ZH-9x16
# Env: CRF (default 16; vertical frames have finer text relative to size), CONCURRENCY, PROPS
set -euo pipefail
COMP=${1:?usage: finalize_vertical.sh <VerticalCompositionId> [output-name] [CoverStillId ...]}
NAME=${2:-$COMP}
shift $(( $# >= 2 ? 2 : 1 ))
HERE="$(cd "$(dirname "$0")" && pwd)"
CRF=${CRF:-16} "$HERE/finalize.sh" "$COMP" "$NAME"
cd "${PAPER_VIDEO_ROOT:-$HERE/..}"
for STILL in "$@"; do
  npx remotion still "$STILL" "out/${NAME}_${STILL}.png" --log=error
  ls -la "out/${NAME}_${STILL}.png"
done
