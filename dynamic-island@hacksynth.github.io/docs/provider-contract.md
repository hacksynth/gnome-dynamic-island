# Provider Contract

A **Provider** supplies `Activity` objects to the `ActivityManager`. Every provider is one `.js` file under `src/providers/` that exports a class with the shape below.

## Interface

```
class MyProvider {
    id = 'my-provider';                          // stable, lowercase
    enable(manager, settings) { /* subscribe */ }
    disable() { /* release everything */ }
}
```

## Lifecycle

- `enable(manager, settings)` runs exactly once per extension-enable cycle.
  - `manager` is the singleton `ActivityManager`. Call `manager.push(activity)`, `manager.update(activity)`, `manager.remove(id)`.
  - `settings` is a `Gio.Settings` scoped to `org.gnome.shell.extensions.dynamic-island`. Provider-specific keys are conventionally prefixed with the provider id.
- `disable()` runs exactly once. It MUST disconnect every signal handler, cancel every timeout, drop every D-Bus proxy, and remove every activity it pushed (via `manager.remove`).

## Producing Activities

Every activity has these fields (see `src/activity.js`):

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable per activity instance. Prefix with provider id (e.g. `media:spotify-dbus`). |
| `providerId` | yes | Must equal `this.id`. |
| `tier` | yes | `transient` / `persistent` / `ambient`. |
| `slot` | yes | `leading` / `trailing` / `either`. |
| `priority` | no | Higher wins within a slot. Default 0. |
| `label` | yes | ≤24 chars preferred. |
| `sublabel` | no | Shown in expanded view. |
| `glyph` | no | `{ icon: Gio.Icon }` or `{ text: '∞' }`. |
| `expandedView` | no | Custom `St.Widget` for the expanded card. |
| `expiresAt` | iff tier=transient | monotonic µs timestamp. |

## Tier choice

- **Transient:** fire-and-forget flashes (volume change, caps lock). MUST set `expiresAt`. Never appears in compact/split; renders as an overlay.
- **Persistent:** long-running state (playing song, active notification). Fills one of the two slots. `remove(id)` to end.
- **Ambient:** shown only in the expanded overflow list (battery level, connected headphones). Never fills a slot.

## Slot choice

- **leading:** upper-left conceptually; typically media, the primary focus.
- **trailing:** upper-right; typically notifications and alerts.
- **either:** flexible — fills whichever is empty (preferring leading).

Trailing-slot activities never migrate to leading even if leading is empty. This is intentional: it keeps layout predictable.

## Testing

Pure provider helpers (e.g., a function that formats an MPRIS metadata dict into a label) can be extracted to a pure module and unit-tested under `tests/`. The provider class itself is verified manually via the nested shell (`scripts/run-nested.sh`) — see `scripts/verify-checklist.md`.
