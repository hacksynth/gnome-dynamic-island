# Contributing

Thanks for your interest in `gnome-dynamic-island`.

## Development setup

Clone the repo and symlink the extension into your user extension dir:

```bash
./scripts/install-dev.sh
```

This also compiles the gschema. GNOME 50 on Wayland removed the
`--nested` flag, so you must log out and log back in before enabling:

```bash
gnome-extensions enable dynamic-island@hacksynth.github.io
```

See `README.md` for troubleshooting notes.

## Running tests

```bash
npm test                             # pure-JS unit tests via `node --test`
shellcheck scripts/*.sh              # shell script lint
msgfmt --check po/zh_CN.po           # gettext catalog validity
```

All three are run by CI on every pull request.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/).
Common prefixes:

- `feat(scope): ...` — new user-facing feature
- `fix(scope): ...` — bug fix
- `docs(scope): ...` — docs only
- `ci(...)`, `chore(...)`, `refactor(...)`, `test(...)`, `style(...)`

Format matters: `release-please` parses these to produce `CHANGELOG.md`
and bump `package.json` on release.

## Translations

If you touched a user-visible string:

```bash
npm run i18n:update                  # regenerate .pot and merge into .po files
# translate new entries in po/<lang>.po
npm run i18n:compile                 # compile .mo files for local testing
```

To add a new language `xx`:

```bash
msginit --input=po/dynamic-island.pot --locale=xx --output-file=po/xx.po
# then translate, then commit po/xx.po
```

## Pull requests

Open PRs against `main`. CI must be green before merge. Keep the diff
focused — one logical change per PR. Conventional-commit titles help
`release-please` generate the right changelog entries.

## Code of Conduct

Participation is subject to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
