# GNOME Dynamic Island — Design Spec

**Date:** 2026-04-19
**Target:** GNOME Shell 50 (Wayland), single-version release
**Status:** Approved for planning

## 1. Goal

A GNOME Shell 50 extension that replaces the center of the top panel with an Adwaita-styled "Dynamic Island" pill — a unified live-activity surface that morphs between five states in response to events from five built-in providers.

The pill shows at most two concurrent activities (leading + trailing), expands on hover or click-to-pin, and briefly flashes for transient system events.

## 2. Scope

### In scope (v1)

- Single Wayland-only GNOME Shell 50 extension.
- Pill widget mounted in `Main.panel._centerBox`; default `DateMenu` hidden while the extension is enabled.
- Five built-in providers: MPRIS2 media, libnotify notifications, volume/brightness OSD, UPower battery, keyboard (layout + caps lock).
- Five view states: idle, compact, split, expanded, transient.
- Hover-to-expand + click-to-pin interaction.
- Adwaita-native visual theme (respects light/dark system theme).
- `Adw.PreferencesWindow` preferences with three groups (Behavior, Providers, Appearance).
- Documented internal `Provider` contract (contributors can add providers via PR).

### Out of scope (v1)

- External drop-in `.js` provider plugins (deferred; contract stability first).
- X11 support.
- Multi-monitor smart placement — pill lives on the primary monitor.
- Touch / gesture interaction.
- Timer, screenshot, screen-recording, AirPods/Bluetooth-connect providers.
- Custom themes beyond the Adwaita-aligned tokens.

## 3. Runtime Architecture

On enable, the extension constructs a singleton **`ActivityManager`** that owns a set of **providers** and emits view-model updates. The **`IslandView`** (a custom `St.Widget`) renders view-models to pixels. An **`InteractionController`** turns pointer/keyboard events back into manager inputs.

```
Providers ──(Activity start/update/end)──▶ ActivityManager ──(ViewModel)──▶ IslandView
                                                  ▲                            │
                                                  │                            ▼
                                          InteractionController ◀── pointer/keyboard
```

### 3.1 Lifecycle

`extension.js` `enable()`:

1. Construct `ActivityManager`.
2. Construct `IslandView`; subscribe it to `view-model-changed`.
3. Mount view into `Main.panel._centerBox` via `panel-integration.js`; hide the default `DateMenu`.
4. Construct `InteractionController`; bind hover/click/keyboard to manager.
5. Instantiate the five providers, passing the manager. Each provider subscribes to its own signal source in its constructor.

`disable()` runs the reverse: destroy providers (unsubscribe signals), destroy controller, unmount view, restore `DateMenu`, null the manager.

### 3.2 Data types

```
Activity = {
  id: string,                // stable per activity instance (e.g. "mpris:spotify:track42")
  providerId: string,        // "media" | "notification" | …
  tier: "transient" | "persistent" | "ambient",
  slot: "leading" | "trailing" | "either",
  priority: integer,         // tie-breaker within tier/slot
  glyph: { icon?: Gio.Icon, cairo?: callback, text?: string },
  label: string,             // short (≤24 chars)
  sublabel?: string,         // for expanded card
  expandedView?: St.Widget,  // optional custom widget; if absent, generic card is used
  startedAt: number,         // monotonic timestamp (GLib.get_monotonic_time); set by ActivityManager on intake
  expiresAt?: number,        // monotonic timestamp; required for transient-tier, unset otherwise
}

ViewModel = {
  baseState: "idle" | "compact" | "split" | "expanded",   // from slot + hover/pin
  leading: Activity | null,
  trailing: Activity | null,
  flashing: Activity | null,    // non-null = transient overlay rendered on top of baseState
  hovered: boolean,
  pinned: boolean,
  ambientOverflow: Activity[],  // shown only when expanded
}
```

`ViewModel` is a plain value object. `IslandView` is a pure function of it.

### 3.3 Testability boundaries

- **Providers** are tested by stubbing their D-Bus / Shell signal source and asserting the `Activity` objects they push.
- **ActivityManager** is tested by feeding synthetic `Activity` streams and asserting the `ViewModel` sequence.
- **IslandView** is tested by constructing view-models directly and asserting classes/geometry.

Each module has one responsibility and one `.js` file; nothing is larger than ~250 lines.

## 4. Behavior Spec

### 4.1 State table

The render is composed of a **baseState** (idle/compact/split/expanded) *plus* an optional **transient overlay** (when `flashing != null`). The overlay is drawn on top of the baseState without clearing the slots, so a flash during playback does not evict the media compact view.

| baseState | Trigger | Slot contents |
|---|---|---|
| **Idle** | No persistent activities, not hovered/pinned | `leading = null, trailing = null` |
| **Compact** | Exactly one persistent activity fills a slot, not hovered/pinned | `leading = act` (or `trailing = act`) |
| **Split** | Both slots filled, not hovered/pinned | `leading, trailing` both set |
| **Expanded** | `hovered = true` or `pinned = true` (regardless of slot count) | Slots render as a rich card |

**Transient overlay** is independent: whenever `flashing != null`, its glyph + label are drawn over the pill, and the pill morphs to its flash geometry for the duration. When `flashing` clears, the pill morphs back to whatever its baseState prescribes.

### 4.2 Tier + slot assignment (runs whenever the activity set changes)

1. Drop activities whose `expiresAt` is in the past.
2. If any `transient`-tier activity is active:
   - Set `flashing = newest transient by timestamp`.
   - Schedule a one-shot timer for its `expiresAt` to re-run assignment.
3. From the `persistent`-tier set:
   - `leading` = highest-priority activity with `slot ∈ {"leading", "either"}`.
   - `trailing` = highest-priority activity with `slot ∈ {"trailing", "either"}` that is not already `leading`.
   - An `"either"` activity fills whichever side is empty, preferring leading.
4. `ambient`-tier activities never fill a slot; they populate `ambientOverflow` for the expanded card only.
5. Derive `baseState`: `expanded` if `hovered || pinned`; else `split` if both slots filled; else `compact` if one slot filled; else `idle`.

The assignment function is pure and unit-testable.

### 4.3 Interaction model

- Pointer enter → `hovered = true` → expanded view.
- Pointer leave → if `pinned = false`, `hovered = false` → collapse.
- Left click on compact/split → `pinned = true`.
- Left click on expanded (outside an interactive control) or Escape key → `pinned = false`.
- Right click → small context menu: "Preferences…", "Disable <current provider>".

Click-to-pin survives pointer-leave so users can reach controls in the expanded card.

### 4.4 Built-in providers

| Provider | Source | Tier | Slot | Notes |
|---|---|---|---|---|
| `MediaProvider` | MPRIS2 D-Bus (`org.mpris.MediaPlayer2.*`) | persistent | leading | Picks currently-playing player; cover art → glyph; expanded card has scrubber + prev/play/next. |
| `NotificationProvider` | `Main.messageTray` signals | persistent | trailing | One activity per active notification source; coalesces multiple into "N new"; expanded shows actions. |
| `VolumeBrightnessProvider` | `Main.osdWindowManager` interception + `Gvc.MixerControl` | transient | either | Flash with level bar; suppresses native OSD window (see §7 risk 1). |
| `PowerProvider` | `Gio.DBusProxy` on `org.freedesktop.UPower` | transient on plug/unplug + low-battery; ambient for steady-state level | either | Ambient entry only appears in expanded overflow. |
| `KeyboardProvider` | `Gio.Settings` `org.gnome.desktop.input-sources` + Clutter caps-lock signal | transient | either | Flash on layout switch or caps-lock toggle. |

### 4.5 Animation

- **Pill morph.** Width, height, border-radius, and child opacity via Clutter implicit animations; 220 ms `ease-out-quad`. Used for all idle ↔ compact ↔ split ↔ expanded transitions.
- **Transient overlay.** The flashing activity mounts as a child of the pill that fades in (120 ms), holds for `transientDurationMs − 240 ms`, then fades out (120 ms). The underlying state is not changed, so a transient fired during playback does not disrupt the media compact view.

## 5. Module Layout

Extension UUID: **`dynamic-island@hacksynth.github.io`** (pin at packaging time; used in filesystem paths and gschema id).

```
dynamic-island@hacksynth.github.io/
├── metadata.json                   # "shell-version": ["50"]
├── extension.js                    # enable/disable lifecycle
├── prefs.js                        # Adw.PreferencesWindow
├── stylesheet.css                  # tokens + state classes
├── src/
│   ├── activity.js                 # Activity + ViewModel types + validators
│   ├── activity-manager.js         # singleton; tier/slot assignment
│   ├── island-view.js              # St.Widget renderer
│   ├── panel-integration.js        # mount/unmount, DateMenu hide/restore
│   ├── interaction-controller.js   # hover + click-pin + right-click menu
│   └── providers/
│       ├── provider-base.js        # documented Provider contract
│       ├── media.js
│       ├── notification.js
│       ├── volume-brightness.js
│       ├── power.js
│       └── keyboard.js
├── schemas/
│   └── org.gnome.shell.extensions.dynamic-island.gschema.xml
└── docs/
    └── provider-contract.md        # public contract for contributors
```

Each `src/` file has one responsibility; no file is expected to exceed ~250 lines.

## 6. Preferences

Single `Adw.PreferencesPage` with three groups. All settings live in the gschema and bind reactively via `Gio.Settings.bind` — no extension restart required.

### 6.1 Behavior

- **Tier order** — drag-sortable list of `transient / persistent / ambient` (default order as listed).
- **Expansion trigger** — dropdown: "Hover + click to pin" (default) or "Click only".
- **Transient flash duration** — slider, 500–3000 ms, default 1500 ms.

### 6.2 Providers

One toggle row per provider. Each row has a "Configure…" button opening an `Adw.PreferencesDialog` with provider-specific settings:

- `media`: "Show cover art on compact" (bool); "Preferred player when multiple" (dropdown populated at open time from currently-registered MPRIS `org.mpris.MediaPlayer2.*` bus names; selecting "Auto" means "most recently played").
- `notification`: "Excluded apps" (list editor); "Coalesce threshold" (int).
- `volume-brightness`: "Replace native OSD" (bool; see §7 risk 1).
- `power`: "Low-battery threshold %" (int).
- `keyboard`: "Flash on caps lock" (bool); "Flash on layout switch" (bool).

### 6.3 Appearance

- **Idle pill content** — dropdown: Clock / Blank / Custom text (entry).
- **Pill width multiplier** — slider 0.8–1.5×, default 1.0.
- **Respect system theme** — always on for v1 (escape hatch for later; hidden behind a `Gio.Settings` key).

## 7. Risks and Open Questions

1. **OSD suppression.** Intercepting `Main.osdWindowManager.show` is undocumented; may break on a GNOME 50 point release. **Mitigation:** pref to "Replace native OSD" defaults to *off*; when off, our transient runs alongside the native OSD.
2. **Center-box collisions.** Other extensions (Clock Override, Frippery Move Clock) modify `_centerBox`. **Mitigation:** on enable, detect foreign children and log a user-facing warning via `Main.notify`; do not silently remove them.
3. **Cover-art fetching.** MPRIS art URLs may be `https://` — loading arbitrary remote resources in gnome-shell risks UI hangs. **Mitigation:** use `St.TextureCache.load_uri_async` with a 2-second timeout; fall back to a generated letter-glyph.
4. **Accessibility.** `St.Widget` defaults produce poor screen-reader output. **Mitigation:** set `accessible_role = PUSH_BUTTON`; set `accessible_name` from the current compact activity's `label`; announce transient flashes via `accessible_description` updates.
5. **Focus stealing.** Click-to-pin must not steal keyboard focus from the currently-focused app. **Mitigation:** the pill's `St.Button` uses `can_focus = false`; the right-click context menu uses a `PopupMenu` which already handles this correctly.

## 8. Non-Goals (v1 explicit)

- External `.js` plugin drop-in system.
- Wayland multi-monitor placement (pill is primary-monitor only).
- X11 support.
- Touch/gesture input.
- Timer, screenshot, screen-recording, Bluetooth-connect providers.
- Deep visual customization beyond the three Adwaita tokens the theme uses.

## 9. Success Criteria

- Installable as a zip via `gnome-extensions install` on GNOME 50.
- Compact view correctly mirrors MPRIS playback within 300 ms of a play/pause change.
- Volume OSD flash appears and auto-collapses within the configured duration, ±50 ms.
- A split state correctly shows media (leading) + incoming notification (trailing).
- Hovering the pill expands it within 150 ms; click-to-pin survives pointer-leave.
- `gnome-extensions disable` cleanly restores the default `DateMenu` with no orphaned signal handlers (verified via `looking-glass`).
- Provider contract documented in `docs/provider-contract.md` is sufficient for a contributor to add a sixth provider without extension-core changes.
