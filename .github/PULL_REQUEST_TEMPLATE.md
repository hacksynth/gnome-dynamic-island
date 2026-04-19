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
