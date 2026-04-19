#!/usr/bin/env bash
set -euo pipefail

UUID="dynamic-island@hacksynth.github.io"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$(dirname "$EXT_DIR")"
rm -rf "$EXT_DIR"
ln -s "$REPO_DIR/$UUID" "$EXT_DIR"

# Compile schema if present.
if [ -d "$REPO_DIR/$UUID/schemas" ]; then
    glib-compile-schemas "$REPO_DIR/$UUID/schemas"
fi

gnome-extensions enable "$UUID" || true

exec dbus-run-session -- gnome-shell --nested --wayland
