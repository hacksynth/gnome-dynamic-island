#!/usr/bin/env bash
# Regenerate po/dynamic-island.pot from sources (JS + gschema) and merge
# the updates into every existing po/*.po catalog.
set -euo pipefail
cd "$(dirname "$0")/.."

EXT=dynamic-island@hacksynth.github.io
ITS=/usr/share/gettext/its/gschema.its

if [ ! -f "$ITS" ]; then
    echo "error: $ITS not found — install the gettext package that ships gschema.its" >&2
    exit 1
fi

# 1. Extract from JavaScript sources listed in po/POTFILES.in.
# --files-from avoids shell word-splitting on paths that could contain spaces.
xgettext --from-code=UTF-8 --language=JavaScript \
    --keyword=_ --keyword=N_ --keyword=ngettext:1,2 \
    --package-name=dynamic-island \
    --copyright-holder="Dynamic Island contributors" \
    --msgid-bugs-address="https://github.com/hacksynth/gnome-dynamic-island/issues" \
    --output=po/dynamic-island.pot \
    --files-from=po/POTFILES.in

# 2. Merge in the gschema <summary>/<description> entries.
xgettext --its="$ITS" --join-existing \
    --output=po/dynamic-island.pot \
    "$EXT"/schemas/*.xml

# 3. Update every existing .po against the new template.
for po in po/*.po; do
    [ -f "$po" ] || continue
    msgmerge --update --backup=none --quiet "$po" po/dynamic-island.pot
done

echo "po/dynamic-island.pot regenerated. Don't forget to translate new entries in po/*.po."
