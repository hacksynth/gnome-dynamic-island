#!/usr/bin/env bash
# Compile every po/*.po to <ext-dir>/locale/<lang>/LC_MESSAGES/dynamic-island.mo
# so the extension picks it up at runtime.
set -euo pipefail
cd "$(dirname "$0")/.."

EXT=dynamic-island@hacksynth.github.io

shopt -s nullglob
for po in po/*.po; do
    lang=$(basename "$po" .po)
    dir="$EXT/locale/$lang/LC_MESSAGES"
    mkdir -p "$dir"
    # --check-format fails the build if a translator dropped a %s / %d.
    msgfmt --check-format "$po" -o "$dir/dynamic-island.mo"
    echo "compiled $po -> $dir/dynamic-island.mo"
done
