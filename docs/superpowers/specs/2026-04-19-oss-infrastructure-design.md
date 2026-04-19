# OSS Infrastructure & main-branch Protection — Design Spec

**Date:** 2026-04-19
**Status:** Approved (brainstorming complete, implementation plan pending)
**Scope:** Add community/legal files, CI, release automation, Dependabot, and
enable GitHub branch protection for `main`.

## 1. Goals & Non-Goals

### Goals

- Bring the public `hacksynth/gnome-dynamic-island` repository up to a complete
  OSS community-standards profile (LICENSE, CoC, CONTRIBUTING, SECURITY,
  CHANGELOG, issue/PR templates, CODEOWNERS).
- Add continuous integration covering the three existing artifact classes:
  pure-JS unit tests, shell scripts, and gettext catalogs.
- Automate release/changelog generation via `release-please` using the existing
  conventional-commit history.
- Protect the `main` branch against direct writes, force-push, deletion, and
  landing red CI.

### Non-goals

- No changes to the GNOME Shell extension source under
  `dynamic-island@hacksynth.github.io/**`.
- No new lint tooling (ESLint / Prettier).
- No `CITATION.cff`, `FUNDING.yml`, `.editorconfig`, or maintainers file.
- No automation for extensions.gnome.org submission.
- No coupling `metadata.json`'s integer `version` to release-please.

## 2. Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | Full (community standards + CI + automation + protection) |
| 2 | License | GPL-2.0-or-later |
| 3 | Branch protection level | Medium: no direct push / delete / force; require PR + CI + linear history + conversation resolution |
| 4 | CI checks | `npm test` + `shellcheck` + `msgfmt --check` |
| 5 | Code of Conduct | Contributor Covenant v2.1, contact `hacksynth@outlook.com` |
| 6 | CHANGELOG | `release-please` automation (conventional commits already in use) |
| 7 | Issue/PR template language | English |
| 8 | Dependabot ecosystems | `github-actions` only |
| 9 | release-please auth | built-in `GITHUB_TOKEN` (manual merge of release PR, protection stays intact) |
| 10 | Rollout | Two-phase: ship all files in one PR → tag `v0.1.0` → enable branch protection |

## 3. File Manifest

### New files (15)

| Path | Purpose |
|---|---|
| `LICENSE` | GPL-2.0-or-later full text (GNU standard, "or any later version") |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 verbatim, contact = `hacksynth@outlook.com` |
| `CONTRIBUTING.md` | Dev setup, commit convention (conventional commits required for release-please), test entry (`npm test`), i18n workflow (`npm run i18n:update`, adding languages) |
| `SECURITY.md` | Supported versions = latest `main`; report via email `hacksynth@outlook.com`; response policy stated as best-effort (solo maintainer) |
| `CHANGELOG.md` | Keep-a-Changelog header + empty `## [Unreleased]` section (release-please takes over thereafter) |
| `.github/CODEOWNERS` | `* @hacksynth` |
| `.github/dependabot.yml` | `package-ecosystem: github-actions`, weekly schedule, `open-pull-requests-limit: 5` |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | YAML form: GNOME version, distro, extension version, reproduction, `journalctl` snippet |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | YAML form: problem, proposed solution, alternatives |
| `.github/ISSUE_TEMPLATE/config.yml` | `blank_issues_enabled: false` |
| `.github/PULL_REQUEST_TEMPLATE.md` | Summary / linked issue / test plan / checklist (conventional commit, `npm test` run, `npm run i18n:update` if strings touched) |
| `.github/workflows/ci.yml` | Three jobs: `test`, `shellcheck`, `i18n-check` (see §4) |
| `.github/workflows/release-please.yml` | Single job invoking `googleapis/release-please-action@v4` (see §5) |
| `release-please-config.json` | `release-type: node`, manages `package.json` version + `CHANGELOG.md` |
| `.release-please-manifest.json` | `{".": "0.1.0"}` |

### Modified files (2)

| Path | Changes |
|---|---|
| `README.md` | Add three badges (CI / License / GNOME Shell 50) at top; add Contributing / Code of Conduct / Security / License sections at bottom. Existing Install / Test / Architecture sections unchanged. |
| `package.json` | Add `license`, `homepage`, `repository`, `bugs` fields. `private: true` retained (not publishing to npm). |

### Unchanged

- `dynamic-island@hacksynth.github.io/**` (extension source)
- `tests/**`, `po/**`, `scripts/**`, `docs/**` (except this spec file)

## 4. CI Workflow — `.github/workflows/ci.yml`

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
        with: { node-version: '20' }
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

Job names `test` / `shellcheck` / `i18n-check` are the exact strings referenced
by branch protection (§6). Jobs run in parallel; expected wall-clock ≤ 1 min.

Rationale:

- `permissions: contents: read` — least privilege; neither CI job writes.
- Triggers on `pull_request` (blocks bad merges) and `push to main` (records a
  default-branch check history so release-please can operate on main).
- Node 20 is current LTS; `tests/*.test.js` use `node --test` (available since
  18), so 20 is a safe choice.

## 5. release-please

### `.github/workflows/release-please.yml`

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

### `release-please-config.json`

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

### `.release-please-manifest.json`

```json
{".": "0.1.0"}
```

### Interaction with branch protection

release-please uses the built-in `GITHUB_TOKEN`. It opens a "chore(main):
release X.Y.Z" PR; the maintainer manually merges it. That PR is subject to
the same three required status checks as any other PR — the protection rule
is self-consistent and does not require any special-case bypass or PAT.

### Initial tag

After the phase-1 PR lands, before enabling branch protection in phase 2, the
maintainer manually creates and pushes `v0.1.0`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This anchors release-please's history scan so that it computes "unreleased
commits" from `v0.1.0` forward, rather than treating the entire pre-existing
history as unreleased.

## 6. Branch Protection — phase 2

After phase-1 PR lands **and** CI has run at least once on `main` **and**
`v0.1.0` is tagged, the maintainer runs this once:

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

### Rule-to-decision mapping (Q3-B)

| Rule | Field | Effect |
|---|---|---|
| No force-push | `allow_force_pushes: false` | Protects history |
| No deletion | `allow_deletions: false` | Prevents accidental branch delete |
| Require PR | `required_pull_request_reviews: {...}` present | Direct push to `main` refused |
| Required CI | `contexts: [test, shellcheck, i18n-check]` | Three checks must be green |
| Strict base | `strict: true` | PR must be up-to-date with `main` before merge |
| Linear history | `required_linear_history: true` | Squash or rebase merge only; merge commits disabled |
| Resolve convos | `required_conversation_resolution: true` | Open review threads block merge |

### Solo-maintainer notes

- `required_approving_review_count: 0` — author may merge own PR once CI is
  green. This matches Q3-B semantics: "require PR + CI, but not review."
- `enforce_admins: false` — admin (the maintainer) retains an emergency-only
  bypass. Acceptable because the repo is solo; revisit if a co-maintainer
  joins.
- Direct `git push origin main` from any client, including the maintainer's,
  is rejected by the server with "protected branch" error.

### Verification

After enabling protection, run:

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

Expected: `required_status_checks` = the three names, every boolean `true`.

### Rollback

```bash
gh api -X DELETE repos/hacksynth/gnome-dynamic-island/branches/main/protection
```

Admin can always disable; the protection cannot self-lock out the maintainer.

## 7. README.md Additions

### Top (after H1, before first existing section)

```markdown
[![CI](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml/badge.svg)](https://github.com/hacksynth/gnome-dynamic-island/actions/workflows/ci.yml)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-50-informational)](https://release.gnome.org/50/)
```

### Bottom (after existing Architecture section)

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

## 8. package.json Additions

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

`private: true` stays — not publishing to npm. release-please with
`release-type: node` only reads/writes `version`, ignoring `private`.

## 9. Rollout Plan

### Phase 1 — single PR on branch `feat/oss-infrastructure`

Commits (order, each conventional-commit-formatted):

1. `chore(license): add GPL-2.0-or-later LICENSE file`
2. `docs(community): add CODE_OF_CONDUCT, CONTRIBUTING, SECURITY`
3. `docs(changelog): initialize CHANGELOG with Keep-a-Changelog header`
4. `ci(github): add issue/PR templates and CODEOWNERS`
5. `ci(github): add dependabot config for github-actions`
6. `ci(workflow): add CI with test, shellcheck, i18n-check jobs`
7. `ci(workflow): add release-please automation`
8. `chore(pkg): add license/repository/bugs/homepage fields`
9. `docs(readme): add badges and community section links`

Each commit should be individually buildable/testable. The PR is opened
against `main`. Required merges: all three CI jobs green, conventional-commit
compliance (so release-please works on these commits later).

### Phase 2 — protection + initial tag (maintainer runs locally)

1. Merge phase-1 PR into `main` (via GitHub UI, squash or rebase).
2. `git checkout main && git pull`
3. `git tag v0.1.0 && git push origin v0.1.0`
4. Run §6 `gh api PUT` protection command.
5. Run §6 verification `jq` block, confirm expected output.

## 10. Acceptance Criteria

### Before merging phase-1 PR

- [ ] `npm test` passes locally (5 test files; no regression from existing
      suite)
- [ ] `shellcheck scripts/*.sh` clean locally (or justified
      `# shellcheck disable=` comments added)
- [ ] `msgfmt --check po/zh_CN.po` clean locally
- [ ] All 15 new files present; 2 modified files match §7–§8 exactly
- [ ] CI on the PR shows three green checks: `test`, `shellcheck`,
      `i18n-check`
- [ ] `gh api repos/hacksynth/gnome-dynamic-island/community/profile` returns
      full community health score (all checklist items present)

### After phase-2 protection

- [ ] §6 verification `jq` block returns all expected `true` / correct
      context list
- [ ] `git push origin main` from maintainer's clone is rejected with
      "protected branch" error
- [ ] A throwaway PR that deliberately fails `npm test` cannot be merged
      (Merge button disabled; red check)
- [ ] The next `push to main` triggers `release-please`; either a
      `chore(main): release` PR appears, or (if no release-worthy unreleased
      commits) it exits cleanly

## 11. Known Edge Cases / Risks

- **`shellcheck` noise on existing scripts.** `update-po.sh`,
  `compile-mo.sh`, `install-dev.sh` have not been linted before. The
  phase-1 PR must either fix any warnings or disable specific codes with
  justification. Phase 1 is not allowed to land with a red `shellcheck`
  job.
- **release-please first run.** With `v0.1.0` tagged before protection is
  enabled, the first post-phase-2 push that contains a feat/fix commit
  will produce a release PR versioned 0.1.1 or 0.2.0 per conventional-
  commit rules. The maintainer retains control by choosing when (or
  whether) to merge that PR.
- **Dependabot churn.** `github-actions` ecosystem will generate PRs as
  `actions/checkout`, `actions/setup-node`, and the release-please action
  version bump. Expected volume: ≤ 2 PRs per month.
- **`msgfmt` in CI.** The `ubuntu-latest` image already includes
  `gettext`; the explicit `apt-get install` is defensive and adds a few
  seconds. Kept for clarity and image-version independence.
- **`lock_branch: false`.** Main remains writable via PR — this is
  intentional. Setting `true` would make the branch read-only entirely
  (archive mode) and break the workflow.

## 12. Out of Scope (explicit)

- No changes to `dynamic-island@hacksynth.github.io/**` source
- No ESLint / Prettier config
- No `CITATION.cff`, `FUNDING.yml`, `.editorconfig`, `MAINTAINERS.md`
- No extensions.gnome.org submission automation
- No release-please management of `metadata.json` version
- No multi-language issue/PR templates (English only)
- No required review approvals (solo maintainer)
- No signed-commit requirement
