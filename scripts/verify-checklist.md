# Manual Verification Checklist

Launch: `./scripts/run-nested.sh`

## Task 9 — Empty shell
- [ ] Pill appears centered in the top panel (idle state, subtle or invisible).
- [ ] Hovering the pill changes its style class to `state-expanded` (use looking-glass: `Main.panel._centerBox.get_children()[?]`).
- [ ] Clicking the pill toggles `state-expanded` even after pointer leave.
- [ ] Pressing Escape while expanded collapses it.
- [ ] Running `gnome-extensions disable dynamic-island@hacksynth.github.io` restores the DateMenu.
- [ ] `gnome-extensions enable …` + disable cycle five times shows no leaked handlers (looking-glass: `Main.panel._centerBox.get_children().length` returns to original).

## Task 10 — Keyboard provider
- [ ] Pressing Caps Lock toggles a flash labelled "Caps Lock on" / "Caps Lock off".
- [ ] Super+Space (or configured layout-switch shortcut) shows a "Layout · <id>" flash.
- [ ] Disabling the "keyboard-flash-caps-lock" key via `dconf write` suppresses the caps flash.
