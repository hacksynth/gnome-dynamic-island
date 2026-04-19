# GNOME Dynamic Island

[![CI](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml/badge.svg)](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-50-informational)](https://release.gnome.org/50/)

A GNOME Shell 50 extension that replaces the top-panel center with an Adwaita-styled Dynamic Island.

## Features

- Replaces the center date/menu area with a compact Dynamic Island pill and
  restores the original panel content when disabled.
- Adapts between idle, compact, split, and expanded visual states based on
  active live activities.
- Shows idle content from settings: local clock, blank, or custom text.
- Displays currently playing MPRIS media with track title and artist.
- Aggregates active notifications in the trailing slot and coalesces them once
  the notification count reaches the configured threshold.
- Flashes transient activity for volume changes, Caps Lock changes, keyboard
  layout switches, charger plug/unplug events, and low battery warnings.
- Tracks battery state through UPower and uses the configured low-battery
  threshold for warnings.
- Lets providers be enabled or disabled from the preferences window, with a
  right-click menu for preferences and disabling the current provider.
- Supports hover-to-expand and click-to-pin interaction, with Escape unpinning
  the island.
- Includes gettext-based localization with Simplified Chinese translations.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: conventional-commit messages,
`npm test` must pass, run `npm run i18n:update` if you touched user-visible strings.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open
public issues for security reports.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
