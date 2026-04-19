# GNOME Dynamic Island

A GNOME Shell 50 extension that replaces the top-panel center with an Adwaita-styled Dynamic Island.

## Install (development)

```
./scripts/run-nested.sh
```

Launches a nested `gnome-shell --nested --wayland` with the extension symlinked and enabled.

## Test

```
npm test            # pure-logic unit tests under node --test
```

## Architecture

See `docs/superpowers/specs/2026-04-19-gnome-dynamic-island-design.md` and `dynamic-island@hacksynth.github.io/docs/provider-contract.md`.
