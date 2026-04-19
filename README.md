# GNOME Dynamic Island

A GNOME Shell 50 extension that replaces the top-panel center with an Adwaita-styled Dynamic Island.

## Install (development)

```
./scripts/install-dev.sh
```

Symlinks the extension into `~/.local/share/gnome-shell/extensions/` and
compiles the gschema. GNOME 50 on Wayland removed the `--nested` flag, so
you'll need to log out and back in, then:

```
gnome-extensions enable dynamic-island@hacksynth.github.io
gnome-extensions prefs  dynamic-island@hacksynth.github.io
```

Watch logs with `journalctl --user --follow /usr/bin/gnome-shell`. If the
extension crashes the shell, switch to a TTY (Ctrl-Alt-F3) and remove
`~/.local/share/gnome-shell/extensions/dynamic-island@hacksynth.github.io`
to recover.

## Test

```
npm test            # pure-logic unit tests under node --test
```

## Architecture

See `docs/superpowers/specs/2026-04-19-gnome-dynamic-island-design.md` and `dynamic-island@hacksynth.github.io/docs/provider-contract.md`.
