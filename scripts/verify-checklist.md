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

## Task 11 — Power provider
- [ ] Plug/unplug the charger (or simulate with `upower -d` + a live session) flashes "Charger connected/disconnected".
- [ ] When battery < 15%, a "Battery low — N%" flash appears on each update.
- [ ] Expanded pill shows an ambient row "N% · Charging/Full/On battery".

## Task 12 — Volume/Brightness provider
- [ ] Pressing volume keys shows a "Volume N%" flash.
- [ ] Muting flashes "Muted 0%".
- [ ] With `volume-replace-native-osd=false` (default), the native OSD still appears alongside.
- [ ] Flipping to `true`, the native OSD is suppressed and only our pill flashes.

## Task 13 — Media provider
- [ ] Start a song in any MPRIS-capable player (Spotify, mpv, rhythmbox); pill shows the title within ~300ms.
- [ ] Pause → pill returns to idle; play → pill returns to compact.
- [ ] Second player started → most recently active wins via `priority` tie-break.
- [ ] Killing the player (e.g., SIGKILL) cleanly removes the pill content without console errors.

## Task 14 — Notification provider
- [ ] `notify-send "Hello" "World"` puts "Hello" into the trailing slot.
- [ ] Sending three more notifications flips the label to "4 new · Notifications".
- [ ] Dismissing all notifications returns the pill to compact (with media if playing) or idle.
- [ ] Adding the sending app to `notification-excluded-apps` via dconf causes subsequent notifications from that app to not appear.

## Task 15 — Preferences window
- [ ] `gnome-extensions prefs dynamic-island@hacksynth.github.io` opens the preferences window.
- [ ] Behavior group: Expansion trigger combo + transient duration spinner + tier order entry.
- [ ] Providers group: five toggle rows, each toggle updates dconf `providers-enabled`.
- [ ] Appearance group: idle-content combo, custom-text entry, pill-width spin.
- [ ] Changing any value updates the live pill without a restart (verified via looking-glass).

## Task 16 — Settings-driven providers
- [ ] Toggling a provider off in prefs removes it live (pill stops reflecting its events).
- [ ] Toggling it back on re-enables without a disable/enable cycle.
- [ ] `gnome-extensions disable …` on the extension disconnects the settings handler (no leaks on re-enable).
