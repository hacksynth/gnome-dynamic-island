#!/usr/bin/env bash
# Install this extension into the user's GNOME Shell directory and compile its
# schema. On GNOME >= 50 (Wayland), the old `gnome-shell --nested` flag has been
# removed, so there's no in-process preview: the extension has to be loaded by
# the running shell.
#
# After running this script, log out and log back in, then enable with:
#     gnome-extensions enable dynamic-island@hacksynth.github.io
#
# If the extension crashes the shell, switch to a TTY (Ctrl-Alt-F3), log in,
# and `rm ~/.local/share/gnome-shell/extensions/dynamic-island@hacksynth.github.io`
# to recover.

set -euo pipefail

UUID="dynamic-island@hacksynth.github.io"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$(dirname "$EXT_DIR")"
rm -rf "$EXT_DIR"
ln -s "$REPO_DIR/$UUID" "$EXT_DIR"
echo "Linked $EXT_DIR -> $REPO_DIR/$UUID"

if [ -d "$REPO_DIR/$UUID/schemas" ]; then
    glib-compile-schemas "$REPO_DIR/$UUID/schemas"
    echo "Compiled schemas in $REPO_DIR/$UUID/schemas"
fi

bash "$(dirname "$0")/compile-mo.sh"

echo
echo "Next steps:"
echo "  1. Log out and log back in (GNOME 50 on Wayland has no shell reload)."
echo "  2. Run: gnome-extensions enable $UUID"
echo "  3. Optionally: gnome-extensions prefs $UUID"
echo
echo "View logs with: journalctl --user --follow /usr/bin/gnome-shell"
