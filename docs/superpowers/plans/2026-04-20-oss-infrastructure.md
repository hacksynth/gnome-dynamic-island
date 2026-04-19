# OSS Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add community/legal files, CI, release-please automation, Dependabot, and enable protected `main` on `hacksynth/gnome-dynamic-island`.

**Architecture:** Two phases on branch `feat/oss-infrastructure`. Phase 1 = 9 commits in one PR adding 15 new files and modifying 2. Phase 2 = tag `v0.1.0` and enable branch protection via `gh api`. Strict reuse of the design spec at `docs/superpowers/specs/2026-04-19-oss-infrastructure-design.md`.

**Tech Stack:** GitHub Actions, release-please v4, Dependabot, Contributor Covenant v2.1, Keep a Changelog, `gh` CLI.

---

## Pre-flight (one-time checks before starting)

- [ ] **Confirm branch and base**

```bash
git rev-parse --abbrev-ref HEAD      # expect: feat/oss-infrastructure
git log --oneline -1                 # expect: "docs(oss): design spec for OSS infrastructure..."
git log --oneline main -1            # expect: 428542d Merge pull request #1 from hacksynth/feat/i18n
git status                           # expect: clean
```

- [ ] **Confirm local tooling present**

```bash
command -v shellcheck || { echo "INSTALL: sudo pacman -S shellcheck (or apt install shellcheck)"; exit 1; }
command -v msgfmt     || { echo "INSTALL: gettext package"; exit 1; }
command -v jq         || { echo "INSTALL: jq"; exit 1; }
command -v gh         || { echo "INSTALL: gh CLI"; exit 1; }
node --version                        # expect v20+ (spec sets CI to node 20)
gh auth status                        # expect authenticated to github.com as hacksynth
```

- [ ] **Baseline CI-equivalents pass on current tree**

```bash
npm test
shellcheck scripts/*.sh
msgfmt --check --statistics --output-file=/dev/null po/zh_CN.po
```

All three must succeed. If `shellcheck` flags existing scripts, record the
warning codes — Task 6 addresses them before CI lands.

---

## Task 1: LICENSE (GPL-2.0-or-later)

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Fetch canonical GPL-2.0 text from GNU**

```bash
curl -fsSL -o LICENSE https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
```

- [ ] **Step 2: Verify content looks canonical**

```bash
wc -l LICENSE
# Expected: somewhere around 339 lines (GNU may adjust whitespace; exact
# count is not load-bearing)
head -3 LICENSE
# Expected first three non-blank lines:
#                     GNU GENERAL PUBLIC LICENSE
#                        Version 2, June 1991
grep -c 'Version 2, June 1991' LICENSE   # Expected: 1
grep -c 'NO WARRANTY'          LICENSE   # Expected: 1
```

The SPDX identifier `GPL-2.0-or-later` is expressed through this text
plus the `package.json` `license` field added in Task 8. GitHub's
repository-license detection recognises the standard GPL-2.0 text
regardless of the "or later" wording.

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "chore(license): add GPL-2.0-or-later LICENSE file"
```

---

## Task 2: Community files (CODE_OF_CONDUCT, CONTRIBUTING, SECURITY)

**Files:**
- Create: `CODE_OF_CONDUCT.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`

- [ ] **Step 1: Fetch Contributor Covenant v2.1**

```bash
curl -fsSL -o CODE_OF_CONDUCT.md \
  https://www.contributor-covenant.org/version/2/1/code_of_conduct.md
grep -c "Contributor Covenant" CODE_OF_CONDUCT.md
# Expected: >= 3 (mentions in title, definition, attribution)
```

- [ ] **Step 2: Fill contact email placeholder**

The template contains a placeholder like `[INSERT CONTACT METHOD]`. Replace
it with the maintainer email.

```bash
grep -n 'INSERT CONTACT METHOD\|\[INSERT\|community leaders.*responsible' CODE_OF_CONDUCT.md
# Find the enforcement section line
sed -i 's|\[INSERT CONTACT METHOD\]|hacksynth@outlook.com|g' CODE_OF_CONDUCT.md
grep -n 'hacksynth@outlook.com' CODE_OF_CONDUCT.md
# Expected: 1 match inside the Enforcement section
grep -c 'INSERT CONTACT METHOD' CODE_OF_CONDUCT.md
# Expected: 0
```

- [ ] **Step 3: Write CONTRIBUTING.md**

```markdown
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
```

Write the above to `CONTRIBUTING.md` (triple-backtick fences around `bash`
and `markdown` blocks inside). Use a heredoc or editor rather than trying
to escape nested fences.

- [ ] **Step 4: Verify CONTRIBUTING.md sanity**

```bash
grep -c '^## ' CONTRIBUTING.md        # Expected: 6 (Development setup, Running tests, Commit messages, Translations, Pull requests, Code of Conduct)
grep 'install-dev.sh' CONTRIBUTING.md # Expected: at least one hit
grep 'i18n:update'   CONTRIBUTING.md  # Expected: at least one hit
```

- [ ] **Step 5: Write SECURITY.md**

```markdown
# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| latest `main` | yes |
| older tags    | no  |

This is a single-maintainer hobby project. Only the current `main` and the
most recent tagged release receive fixes.

## Reporting a vulnerability

Email **hacksynth@outlook.com** with:

- A clear description of the issue.
- Reproduction steps (including GNOME Shell version, distribution,
  extension version from `metadata.json`).
- The impact you expect (crash, privilege escalation, data leak, etc.).

Do not open a public GitHub issue for security reports.

## Response

Response is on a best-effort basis. You should expect an initial
acknowledgement within two weeks. Please give the maintainer a
reasonable window to fix an issue before any public disclosure.
```

- [ ] **Step 6: Verify SECURITY.md**

```bash
grep -c 'hacksynth@outlook.com' SECURITY.md   # Expected: 1
grep 'Supported versions' SECURITY.md         # Expected: match
```

- [ ] **Step 7: Commit**

```bash
git add CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md
git commit -m "docs(community): add CODE_OF_CONDUCT, CONTRIBUTING, SECURITY"
```

---

## Task 3: CHANGELOG.md (Keep a Changelog seed)

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write initial CHANGELOG**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

From version `0.1.0` onward, entries in this file are generated by
[`release-please`](https://github.com/googleapis/release-please) from
conventional commit messages.

## [Unreleased]
```

- [ ] **Step 2: Verify**

```bash
grep -c '^## \[Unreleased\]' CHANGELOG.md    # Expected: 1
grep 'release-please' CHANGELOG.md           # Expected: match
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): initialize CHANGELOG with Keep-a-Changelog header"
```

---

## Task 4: Issue/PR templates and CODEOWNERS

**Files:**
- Create: `.github/CODEOWNERS`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create `.github/` directory and CODEOWNERS**

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

Write `.github/CODEOWNERS`:

```
# Default owner for everything in this repo
* @hacksynth
```

- [ ] **Step 2: Write `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
```

- [ ] **Step 3: Write `.github/ISSUE_TEMPLATE/bug_report.yml`**

```yaml
name: Bug report
description: Something in the extension misbehaves
labels: [bug]
body:
  - type: input
    id: gnome-version
    attributes:
      label: GNOME Shell version
      description: Run `gnome-shell --version`
      placeholder: "GNOME Shell 50.0"
    validations:
      required: true
  - type: input
    id: distro
    attributes:
      label: Distribution
      placeholder: "Arch / Fedora 42 / Ubuntu 26.04 / ..."
    validations:
      required: true
  - type: input
    id: ext-version
    attributes:
      label: Extension version
      description: From `metadata.json` in your installed extension directory.
      placeholder: "0.1.0 (or git commit sha)"
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Reproduction steps
      description: Numbered steps, starting from a fresh session if possible.
      placeholder: |
        1. Enable the extension
        2. Plug in headphones
        3. ...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behaviour
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual behaviour
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: |
        `journalctl --user -b 0 /usr/bin/gnome-shell | tail -200`
      render: shell
```

- [ ] **Step 4: Write `.github/ISSUE_TEMPLATE/feature_request.yml`**

```yaml
name: Feature request
description: Suggest an improvement or new capability
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: What problem does this solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
  - type: textarea
    id: context
    attributes:
      label: Additional context
```

- [ ] **Step 5: Write `.github/PULL_REQUEST_TEMPLATE.md`**

```markdown
## Summary

<!-- One or two sentences describing the change. -->

## Linked issue

<!-- Closes #N, or "no linked issue" -->

## Test plan

<!-- What you did to verify the change works. -->

- [ ] `npm test` passes locally
- [ ] `shellcheck scripts/*.sh` passes (if scripts changed)
- [ ] `npm run i18n:update` re-run and `po/zh_CN.po` updated (if user-visible strings changed)
- [ ] Manually verified in a logged-in GNOME 50 session (if behaviour changed)

## Commit style

- [ ] Each commit follows [Conventional Commits](https://www.conventionalcommits.org/)
      so that `release-please` can parse the history.
```

- [ ] **Step 6: Validate YAML**

```bash
for f in .github/ISSUE_TEMPLATE/bug_report.yml \
         .github/ISSUE_TEMPLATE/feature_request.yml \
         .github/ISSUE_TEMPLATE/config.yml; do
  python3 -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" "$f" && echo "OK: $f"
done
```

All three must print `OK:`. If Python is absent, use `yq eval . <file>`
or any YAML parser. Markdown files (`CODEOWNERS`,
`PULL_REQUEST_TEMPLATE.md`) are freeform and do not need parsing.

- [ ] **Step 7: Commit**

```bash
git add .github/CODEOWNERS .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md
git commit -m "ci(github): add issue/PR templates and CODEOWNERS"
```

---

## Task 5: Dependabot config

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Write the config**

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    commit-message:
      prefix: "ci"
      include: "scope"
```

The `commit-message.prefix: ci` + `include: scope` makes Dependabot emit
conventional-commit titles like `ci(deps): bump actions/checkout from 4 to
5`, which `release-please` will classify as non-release commits
(harmless).

- [ ] **Step 2: Validate**

```bash
python3 -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" .github/dependabot.yml && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci(github): add dependabot config for github-actions"
```

---

## Task 6: CI workflow (`test` + `shellcheck` + `i18n-check`)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Re-run local shellcheck and handle any warnings**

```bash
shellcheck scripts/*.sh
echo "exit: $?"
```

If exit is non-zero: read each warning. Choose per warning:

- **Fix the script** if the warning is legitimate (preferred).
- **Inline-disable** with a targeted comment on the offending line only
  if the warning is a false positive for this repo's shell usage:
  `# shellcheck disable=SCxxxx`

Do not use repository-wide `.shellcheckrc` suppressions. If you made any
edits, stage them now so they go into this task's commit:

```bash
git diff scripts/   # review your fixes
git add scripts/
```

Re-run `shellcheck scripts/*.sh` until exit is 0.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test

  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y shellcheck
      - run: shellcheck scripts/*.sh

  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: msgfmt --check --statistics --output-file=/dev/null po/zh_CN.po
```

- [ ] **Step 3: Validate YAML**

```bash
python3 -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" .github/workflows/ci.yml && echo OK
```

- [ ] **Step 4: Verify job names match what Task 12 will require**

```bash
grep -E '^  (test|shellcheck|i18n-check):$' .github/workflows/ci.yml | wc -l
# Expected: 3
```

Exact strings `test`, `shellcheck`, `i18n-check` must be present — Task 12
references them literally in the branch-protection `contexts` array.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
# If Step 1 produced script edits, they should already be staged from
# that step. Verify:
git diff --cached --stat
# Expected: .github/workflows/ci.yml, plus any scripts/*.sh you fixed.
git commit -m "ci(workflow): add CI with test, shellcheck, i18n-check jobs"
```

---

## Task 7: release-please automation

**Files:**
- Create: `.github/workflows/release-please.yml`
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

- [ ] **Step 1: Write `.github/workflows/release-please.yml`**

```yaml
name: release-please
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

- [ ] **Step 2: Write `release-please-config.json`**

```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "gnome-dynamic-island",
      "changelog-path": "CHANGELOG.md",
      "include-v-in-tag": true,
      "draft": false,
      "prerelease": false
    }
  }
}
```

- [ ] **Step 3: Write `.release-please-manifest.json`**

```json
{".": "0.1.0"}
```

- [ ] **Step 4: Validate JSON/YAML**

```bash
jq empty release-please-config.json && echo "config OK"
jq empty .release-please-manifest.json && echo "manifest OK"
jq -r '.packages["."].release-type' release-please-config.json
# Expected: node
jq -r '.["."]' .release-please-manifest.json
# Expected: 0.1.0
python3 -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" .github/workflows/release-please.yml && echo "workflow OK"
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release-please.yml release-please-config.json .release-please-manifest.json
git commit -m "ci(workflow): add release-please automation"
```

---

## Task 8: package.json — license, repository, bugs, homepage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current state**

```bash
cat package.json
```

Current scripts/fields: `name`, `version`, `private`, `type`, `scripts`
(`test`, `i18n:update`, `i18n:compile`). No `license`/`homepage`/
`repository`/`bugs`.

- [ ] **Step 2: Rewrite the file**

```json
{
  "name": "gnome-dynamic-island",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "GPL-2.0-or-later",
  "homepage": "https://github.com/hacksynth/gnome-dynamic-island",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/hacksynth/gnome-dynamic-island.git"
  },
  "bugs": {
    "url": "https://github.com/hacksynth/gnome-dynamic-island/issues"
  },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "i18n:update": "bash scripts/update-po.sh",
    "i18n:compile": "bash scripts/compile-mo.sh"
  }
}
```

- [ ] **Step 3: Validate and confirm behaviour unchanged**

```bash
jq . package.json > /dev/null && echo "JSON OK"
jq -r '.license, .homepage, .repository.url, .bugs.url' package.json
# Expected:
# GPL-2.0-or-later
# https://github.com/hacksynth/gnome-dynamic-island
# git+https://github.com/hacksynth/gnome-dynamic-island.git
# https://github.com/hacksynth/gnome-dynamic-island/issues
npm test
# Expected: same tests still pass (license/repo fields do not affect node --test)
```

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(pkg): add license, repository, bugs, homepage fields"
```

---

## Task 9: README — badges and community section links

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current state**

```bash
cat README.md
```

Structure today: `# GNOME Dynamic Island` H1, one-line description, then
sections `## Install (development)`, `## Test`, `## Architecture`.

- [ ] **Step 2: Insert three badges directly after the H1 line**

The badges go on their own three lines, followed by a blank line, followed
by the existing description. Result (only showing the top):

```markdown
# GNOME Dynamic Island

[![CI](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml/badge.svg)](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-50-informational)](https://release.gnome.org/50/)

A GNOME Shell 50 extension that replaces the top-panel center with an Adwaita-styled Dynamic Island.
```

- [ ] **Step 3: Append four new sections at the end of the file**

After the existing `## Architecture` section, add exactly:

```markdown

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
```

- [ ] **Step 4: Verify structure**

```bash
grep -c '^## ' README.md
# Expected: 7 (Install, Test, Architecture, Contributing, Code of Conduct, Security, License)
grep -c 'badge.svg\|img.shields.io' README.md
# Expected: 3
grep 'CONTRIBUTING.md' README.md     # Expected: match
grep 'CODE_OF_CONDUCT.md' README.md  # Expected: match
grep 'SECURITY.md' README.md         # Expected: match
grep 'LICENSE' README.md             # Expected: match (appears in badge + footer)
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(readme): add badges and community section links"
```

---

## Task 10: Open PR, wait for green CI, merge

**Files:** none created; this is the gate between phase 1 and phase 2.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/oss-infrastructure
```

- [ ] **Step 2: Open PR against main**

```bash
gh pr create --base main --head feat/oss-infrastructure \
  --title "chore(infra): OSS community files, CI, release-please, protection prep" \
  --body "$(cat <<'EOF'
## Summary

- Adds LICENSE (GPL-2.0-or-later), CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, CHANGELOG
- Adds issue/PR templates, CODEOWNERS, Dependabot (github-actions)
- Adds CI workflow (`test` / `shellcheck` / `i18n-check`)
- Adds release-please automation (manifest starts at 0.1.0)
- Updates README with badges + community section; package.json gets license / repo / bugs / homepage fields

Implements the spec at `docs/superpowers/specs/2026-04-19-oss-infrastructure-design.md`.

Branch protection on `main` will be enabled after this PR lands (phase 2).

## Test plan

- [x] `npm test` passes locally
- [x] `shellcheck scripts/*.sh` passes locally
- [x] `msgfmt --check po/zh_CN.po` passes locally
- [x] All YAML/JSON files syntax-checked with yaml.safe_load / jq
- [ ] CI (`test` / `shellcheck` / `i18n-check`) green on this PR
EOF
)"
```

- [ ] **Step 3: Wait for CI and verify all three checks green**

```bash
gh pr checks --watch
# Hit Ctrl-C once all rows show "pass"
gh pr checks
# Expected: three rows — test / shellcheck / i18n-check — all "pass"
```

If any check fails: read logs with `gh run view --log-failed`, fix on the
branch, re-push. Do not proceed to Step 4 until all three are green.

- [ ] **Step 4: Merge**

Use squash merge (keeps linear history on `main`, matches the branch
protection rule added later):

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Update local main**

```bash
git checkout main
git pull --ff-only
git log --oneline -3
# Expected: squash-merge commit at top of main referencing this PR
```

---

## Task 11: Tag v0.1.0

**Files:** none; remote tag only.

- [ ] **Step 1: Tag and push**

```bash
git tag -a v0.1.0 -m "Initial release baseline for release-please"
git push origin v0.1.0
```

- [ ] **Step 2: Verify the tag exists locally and remotely**

```bash
git tag -l v0.1.0
# Expected: v0.1.0
gh api repos/hacksynth/gnome-dynamic-island/git/refs/tags/v0.1.0 --jq '.ref'
# Expected: refs/tags/v0.1.0
```

This anchors release-please's "unreleased" window to commits after
`v0.1.0`.

---

## Task 12: Enable branch protection

**Files:** none; GitHub API state only.

- [ ] **Step 1: Confirm required checks have actually run on main at least once**

```bash
gh api repos/hacksynth/gnome-dynamic-island/commits/main/check-runs \
  --jq '[.check_runs[].name] | sort | unique'
# Expected to contain: ["i18n-check", "shellcheck", "test"]
```

If the names are missing, the push to `main` from Task 10 has not
triggered CI yet — wait and re-run. Names must exist before we require
them, otherwise the protection rule creates a "pending forever" state.

- [ ] **Step 2: Apply protection**

```bash
gh api -X PUT repos/hacksynth/gnome-dynamic-island/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test", "shellcheck", "i18n-check"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

Expected HTTP 200 with JSON describing the new protection.

---

## Task 13: Verify protection + sanity tests

**Files:** none; confirmation only.

- [ ] **Step 1: Read protection back and check every rule**

```bash
gh api repos/hacksynth/gnome-dynamic-island/branches/main/protection | jq '{
  required_status_checks: .required_status_checks.contexts,
  strict: .required_status_checks.strict,
  require_pr: (.required_pull_request_reviews != null),
  linear: .required_linear_history.enabled,
  no_force: (.allow_force_pushes.enabled | not),
  no_delete: (.allow_deletions.enabled | not),
  conv_resolution: .required_conversation_resolution.enabled
}'
```

Expected output:

```json
{
  "required_status_checks": ["test", "shellcheck", "i18n-check"],
  "strict": true,
  "require_pr": true,
  "linear": true,
  "no_force": true,
  "no_delete": true,
  "conv_resolution": true
}
```

Every field must match. If any differs, re-run Task 12 with a corrected
JSON body.

- [ ] **Step 2: Verify direct push is blocked**

```bash
git checkout main
git commit --allow-empty -m "test: protection sanity check"
git push origin main
# Expected: server rejects with a message mentioning "protected branch"
git reset --hard HEAD~1           # drop the local throwaway commit
```

- [ ] **Step 3: Verify community health is satisfied**

```bash
gh api repos/hacksynth/gnome-dynamic-island/community/profile \
  --jq '{ health_percentage, files: (.files | to_entries | map({key, present: (.value != null)})) }'
```

Expected `health_percentage: 100` and every file entry `present: true`
(README, CODE_OF_CONDUCT, CONTRIBUTING, LICENSE, PULL_REQUEST_TEMPLATE,
ISSUE_TEMPLATE).

- [ ] **Step 4: (Optional) verify CI gate by attempting a red PR**

```bash
git checkout -b test/ci-gate main
node -e 'process.exit(1)' > /dev/null 2>&1 || true
cat >> tests/provider-base.test.js <<'EOF'

import { test } from 'node:test';
test('intentional failure to verify CI gate', () => { throw new Error('gate check'); });
EOF
git add tests/provider-base.test.js
git commit -m "test(ci): deliberate failure for protection gate check"
git push -u origin test/ci-gate
gh pr create --base main --head test/ci-gate --title "test: ci gate" --body "throwaway"
gh pr checks --watch
# Expected: test job fails, merge button disabled in UI
gh pr close --delete-branch
git checkout main
git branch -D test/ci-gate
```

This is optional — run it once to prove the gate works, then skip for
future infra changes.

- [ ] **Step 5: Final state check**

```bash
gh repo view hacksynth/gnome-dynamic-island --json licenseInfo,defaultBranchRef,hasIssuesEnabled \
  --jq '{license: .licenseInfo.spdxId, default: .defaultBranchRef.name, issues: .hasIssuesEnabled}'
# Expected: { "license": "GPL-2.0-or-later", "default": "main", "issues": true }
```

If `license` is `null`, GitHub has not yet re-scanned the repo; wait a few
minutes. The LICENSE file is the source of truth; this field is a derived
convenience.

- [ ] **Step 6: Archive this implementation plan**

No commit needed — the plan stays in
`docs/superpowers/plans/2026-04-20-oss-infrastructure.md` as a record.

---

## Acceptance summary

When all 13 tasks are complete:

- 15 new files + 2 modified files are on `main` via a squash-merged PR.
- `main` is protected: no direct push, no force-push, no deletion; PRs
  require the three green checks, linear history, and all conversations
  resolved.
- `v0.1.0` tag exists on `main`'s tip commit.
- release-please workflow is armed; the next push to `main` with any
  `feat:` or `fix:` commit will produce a release PR.
- Dependabot is polling `github-actions` weekly.
- GitHub "community profile" reports 100% health.
