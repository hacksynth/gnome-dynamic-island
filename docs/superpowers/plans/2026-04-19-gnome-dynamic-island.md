# GNOME Dynamic Island — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a GNOME Shell 50 extension that replaces the top-panel center with an Adwaita-styled "Dynamic Island" pill surfacing five built-in activity providers under a tier/slot model.

**Architecture:** A singleton `ActivityManager` (pure JS, unit-testable) owns slot/tier assignment and emits immutable `ViewModel`s to an `IslandView` (`St.Widget`). Five providers feed `Activity` objects in; an `InteractionController` feeds hover/click state in. Pure modules are node-testable; GNOME-bound modules use a manual verification checklist inside a nested `gnome-shell`.

**Tech Stack:** GJS (ESM), GTK4/Adwaita (prefs), Clutter + St (view), Gio D-Bus (providers), Node `--test` runner for unit tests, nested `gnome-shell --nested --wayland` for integration verification.

**Source of truth:** `docs/superpowers/specs/2026-04-19-gnome-dynamic-island-design.md` (commit `cc43dd2`).

---

## File Structure

Extension UUID: `dynamic-island@hacksynth.github.io`. Source root is a sibling of `docs/`:

```
gnome-dynamic-island/
├── dynamic-island@hacksynth.github.io/
│   ├── metadata.json
│   ├── extension.js
│   ├── prefs.js
│   ├── stylesheet.css
│   ├── src/
│   │   ├── activity.js                 # pure — Activity + ViewModel factories/validators
│   │   ├── activity-manager.js         # pure — tier/slot assignment, subscribe callbacks
│   │   ├── panel-integration.js        # gi — mount/unmount, DateMenu hide
│   │   ├── island-view.js              # gi — St.Widget renderer
│   │   ├── interaction-controller.js   # gi — hover/click-pin/escape
│   │   └── providers/
│   │       ├── provider-base.js        # pure — Provider contract validator
│   │       ├── media.js                # gi — MPRIS2
│   │       ├── notification.js         # gi — messageTray
│   │       ├── volume-brightness.js    # gi — osdWindowManager + MixerControl
│   │       ├── power.js                # gi — UPower
│   │       └── keyboard.js             # gi — input-sources + caps lock
│   ├── schemas/
│   │   └── org.gnome.shell.extensions.dynamic-island.gschema.xml
│   └── docs/
│       └── provider-contract.md
├── tests/
│   ├── activity.test.js
│   ├── activity-manager.test.js
│   └── provider-base.test.js
├── scripts/
│   ├── run-nested.sh                   # nested gnome-shell launcher for manual verify
│   └── verify-checklist.md             # integration steps
├── package.json                        # node test config (no runtime deps)
├── .gitignore
└── docs/ (specs + plans)
```

**Purity rule.** `activity.js`, `activity-manager.js`, and `provider-base.js` MUST NOT contain `gi://` imports. They run unchanged under both `node --test` and `gjs`. Every other `src/` file may import `gi://*`.

---

## Testing Strategy

- **Pure modules** → Node's built-in `node --test` runner. No external deps; GNOME 50 ships with Node ≥ 20 on all supported distros.
- **GNOME-bound modules** → Manual verification inside `gnome-shell --nested --wayland`. Each such task includes an explicit checklist of observable behaviors.
- **Commit cadence** → One commit per task. Tests and implementation for the same task go in the same commit.

---

## Task 0: Project scaffolding

**Files:**
- Create: `dynamic-island@hacksynth.github.io/metadata.json`
- Create: `dynamic-island@hacksynth.github.io/extension.js`
- Create: `dynamic-island@hacksynth.github.io/stylesheet.css`
- Create: `package.json`
- Create: `.gitignore` (append)
- Create: `scripts/run-nested.sh`

- [ ] **Step 1: Append node artifacts to `.gitignore`**

Modify `.gitignore` to full content:

```
.superpowers/
node_modules/
*.log
dynamic-island@hacksynth.github.io/schemas/gschemas.compiled
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "gnome-dynamic-island",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Create `dynamic-island@hacksynth.github.io/metadata.json`**

```json
{
  "name": "Dynamic Island",
  "description": "Unified live-activity pill that replaces the top-panel center with a morphing Adwaita-styled island.",
  "uuid": "dynamic-island@hacksynth.github.io",
  "shell-version": ["50"],
  "url": "https://github.com/hacksynth/gnome-dynamic-island",
  "settings-schema": "org.gnome.shell.extensions.dynamic-island"
}
```

- [ ] **Step 4: Create empty `dynamic-island@hacksynth.github.io/extension.js`**

```javascript
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class DynamicIslandExtension extends Extension {
    enable() {
        // Wired in Task 9.
    }

    disable() {
        // Wired in Task 9.
    }
}
```

- [ ] **Step 5: Create empty `dynamic-island@hacksynth.github.io/stylesheet.css`**

```css
/* Island styles are populated in Task 6. */
```

- [ ] **Step 6: Create `scripts/run-nested.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

UUID="dynamic-island@hacksynth.github.io"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$(dirname "$EXT_DIR")"
rm -rf "$EXT_DIR"
ln -s "$REPO_DIR/$UUID" "$EXT_DIR"

# Compile schema if present.
if [ -d "$REPO_DIR/$UUID/schemas" ]; then
    glib-compile-schemas "$REPO_DIR/$UUID/schemas"
fi

gnome-extensions enable "$UUID" || true

exec dbus-run-session -- gnome-shell --nested --wayland
```

- [ ] **Step 7: Make the script executable and smoke-test node test discovery**

Run:
```
chmod +x scripts/run-nested.sh
node --test tests/ 2>&1 | tail -5
```
Expected: `tests 0` (no tests yet, but the runner exits 0).

- [ ] **Step 8: Commit**

```bash
git add .gitignore package.json scripts/run-nested.sh dynamic-island@hacksynth.github.io/
git commit -m "chore: scaffold extension skeleton and node test runner"
```

---

## Task 1: `Activity` + `ViewModel` types

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/activity.js`
- Create: `tests/activity.test.js`

- [ ] **Step 1: Write the failing tests in `tests/activity.test.js`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createActivity,
    assertActivity,
    emptyViewModel,
    TIERS,
    SLOTS,
} from '../dynamic-island@hacksynth.github.io/src/activity.js';

test('createActivity fills defaults and a monotonic startedAt', () => {
    const a = createActivity({
        id: 'x',
        providerId: 'media',
        tier: 'persistent',
        slot: 'leading',
        label: 'Track',
    });
    assert.equal(a.id, 'x');
    assert.equal(a.priority, 0);
    assert.ok(typeof a.startedAt === 'number');
    assert.equal(a.expiresAt, undefined);
});

test('createActivity rejects unknown tier', () => {
    assert.throws(
        () => createActivity({ id: 'x', providerId: 'p', tier: 'weird', slot: 'either', label: 'L' }),
        /tier/,
    );
});

test('createActivity rejects unknown slot', () => {
    assert.throws(
        () => createActivity({ id: 'x', providerId: 'p', tier: 'persistent', slot: 'middle', label: 'L' }),
        /slot/,
    );
});

test('createActivity requires id, providerId, label', () => {
    for (const missing of ['id', 'providerId', 'label']) {
        const good = { id: 'x', providerId: 'p', tier: 'persistent', slot: 'either', label: 'L' };
        delete good[missing];
        assert.throws(() => createActivity(good), new RegExp(missing));
    }
});

test('assertActivity accepts a built activity', () => {
    const a = createActivity({ id: 'x', providerId: 'p', tier: 'ambient', slot: 'either', label: 'L' });
    assert.doesNotThrow(() => assertActivity(a));
});

test('emptyViewModel has all required fields', () => {
    const vm = emptyViewModel();
    assert.equal(vm.baseState, 'idle');
    assert.equal(vm.leading, null);
    assert.equal(vm.trailing, null);
    assert.equal(vm.flashing, null);
    assert.equal(vm.hovered, false);
    assert.equal(vm.pinned, false);
    assert.deepEqual(vm.ambientOverflow, []);
});

test('TIERS and SLOTS enumerate the contract', () => {
    assert.deepEqual([...TIERS].sort(), ['ambient', 'persistent', 'transient']);
    assert.deepEqual([...SLOTS].sort(), ['either', 'leading', 'trailing']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/activity.test.js`
Expected: 7 failing tests with "Cannot find module ... src/activity.js" (or similar import error).

- [ ] **Step 3: Implement `src/activity.js`**

```javascript
// Pure module — no gi imports. Runs under both node and gjs.

export const TIERS = Object.freeze(new Set(['transient', 'persistent', 'ambient']));
export const SLOTS = Object.freeze(new Set(['leading', 'trailing', 'either']));

let _fakeClock = null;
export function _setFakeClock(fn) { _fakeClock = fn; }           // test hook
export function _now() { return _fakeClock ? _fakeClock() : Date.now() * 1000; }

export function createActivity(spec) {
    for (const field of ['id', 'providerId', 'label']) {
        if (typeof spec[field] !== 'string' || spec[field].length === 0)
            throw new Error(`Activity ${field} is required (string)`);
    }
    if (!TIERS.has(spec.tier))
        throw new Error(`Activity tier must be one of ${[...TIERS].join('|')} (got ${spec.tier})`);
    if (!SLOTS.has(spec.slot))
        throw new Error(`Activity slot must be one of ${[...SLOTS].join('|')} (got ${spec.slot})`);

    return Object.freeze({
        id: spec.id,
        providerId: spec.providerId,
        tier: spec.tier,
        slot: spec.slot,
        priority: Number.isFinite(spec.priority) ? spec.priority : 0,
        glyph: spec.glyph ?? null,
        label: spec.label,
        sublabel: spec.sublabel ?? null,
        expandedView: spec.expandedView ?? null,
        startedAt: Number.isFinite(spec.startedAt) ? spec.startedAt : _now(),
        expiresAt: Number.isFinite(spec.expiresAt) ? spec.expiresAt : undefined,
    });
}

export function assertActivity(a) {
    if (!a || typeof a !== 'object') throw new Error('Activity must be an object');
    for (const field of ['id', 'providerId', 'label']) {
        if (typeof a[field] !== 'string') throw new Error(`Activity.${field} must be string`);
    }
    if (!TIERS.has(a.tier)) throw new Error(`Activity.tier invalid: ${a.tier}`);
    if (!SLOTS.has(a.slot)) throw new Error(`Activity.slot invalid: ${a.slot}`);
    if (typeof a.startedAt !== 'number') throw new Error('Activity.startedAt must be number');
}

export function emptyViewModel() {
    return {
        baseState: 'idle',
        leading: null,
        trailing: null,
        flashing: null,
        hovered: false,
        pinned: false,
        ambientOverflow: [],
    };
}
```

- [ ] **Step 4: Re-run tests and confirm they pass**

Run: `node --test tests/activity.test.js`
Expected: `# pass 7` / `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add tests/activity.test.js dynamic-island@hacksynth.github.io/src/activity.js
git commit -m "feat(model): Activity + ViewModel contract with validators"
```

---

## Task 2: `ActivityManager` — tier/slot assignment

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/activity-manager.js`
- Create: `tests/activity-manager.test.js`

- [ ] **Step 1: Write failing tests in `tests/activity-manager.test.js`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActivity, _setFakeClock } from '../dynamic-island@hacksynth.github.io/src/activity.js';
import { ActivityManager } from '../dynamic-island@hacksynth.github.io/src/activity-manager.js';

function mgr() {
    const m = new ActivityManager();
    const models = [];
    m.subscribe(vm => models.push(vm));
    return { m, models, last: () => models[models.length - 1] };
}

function act(spec) { return createActivity(spec); }

test('empty manager emits idle view-model on subscribe', () => {
    const { last } = mgr();
    assert.equal(last().baseState, 'idle');
});

test('one persistent leading → compact', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
    assert.equal(last().baseState, 'compact');
    assert.equal(last().leading.id, 'a');
    assert.equal(last().trailing, null);
});

test('two persistents filling both slots → split', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
    m.push(act({ id: 'b', providerId: 'notification', tier: 'persistent', slot: 'trailing', label: 'Msg' }));
    assert.equal(last().baseState, 'split');
    assert.equal(last().leading.id, 'a');
    assert.equal(last().trailing.id, 'b');
});

test('either-slot activity fills leading first', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'e', providerId: 'p', tier: 'persistent', slot: 'either', label: 'E' }));
    assert.equal(last().leading.id, 'e');
    assert.equal(last().trailing, null);
});

test('higher priority wins within a slot', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'low', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L', priority: 0 }));
    m.push(act({ id: 'hi',  providerId: 'p', tier: 'persistent', slot: 'leading', label: 'H', priority: 5 }));
    assert.equal(last().leading.id, 'hi');
});

test('hover promotes baseState to expanded regardless of slot count', () => {
    const { m, last } = mgr();
    m.setHover(true);
    assert.equal(last().baseState, 'expanded');
    m.push(act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L' }));
    assert.equal(last().baseState, 'expanded');
    m.setHover(false);
    assert.equal(last().baseState, 'compact');
});

test('pin survives hover-off', () => {
    const { m, last } = mgr();
    m.setPinned(true);
    m.setHover(true);
    m.setHover(false);
    assert.equal(last().baseState, 'expanded');
    m.setPinned(false);
    assert.equal(last().baseState, 'idle');
});

test('transient sets flashing and keeps underlying slots', () => {
    let t = 1_000_000;
    _setFakeClock(() => t);
    const { m, last } = mgr();
    m.push(act({ id: 'media', providerId: 'media', tier: 'persistent', slot: 'leading', label: 'Song' }));
    m.push(act({ id: 'vol',   providerId: 'volume', tier: 'transient', slot: 'either', label: '70%',
                 expiresAt: t + 1_500_000 }));
    assert.equal(last().flashing.id, 'vol');
    assert.equal(last().leading.id, 'media');
    assert.equal(last().baseState, 'compact');   // underlying unchanged
    _setFakeClock(null);
});

test('transient clears when clock passes expiresAt and tick() runs', () => {
    let t = 1_000_000;
    _setFakeClock(() => t);
    const { m, last } = mgr();
    m.push(act({ id: 'vol', providerId: 'volume', tier: 'transient', slot: 'either', label: '70%',
                 expiresAt: t + 1_500_000 }));
    assert.equal(last().flashing.id, 'vol');
    t = t + 2_000_000;
    m.tick();
    assert.equal(last().flashing, null);
    _setFakeClock(null);
});

test('ambient activities populate ambientOverflow only', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'batt', providerId: 'power', tier: 'ambient', slot: 'either', label: '42%' }));
    assert.equal(last().leading, null);
    assert.equal(last().baseState, 'idle');
    assert.equal(last().ambientOverflow.length, 1);
    assert.equal(last().ambientOverflow[0].id, 'batt');
});

test('remove drops the activity and re-runs assignment', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'A' }));
    m.push(act({ id: 'b', providerId: 'p', tier: 'persistent', slot: 'trailing', label: 'B' }));
    assert.equal(last().baseState, 'split');
    m.remove('a');
    assert.equal(last().baseState, 'compact');
    assert.equal(last().leading.id, 'b');   // b migrates to leading via either-like fallback for trailing-slot? See note.
});

test('update replaces an activity by id preserving startedAt ordering', () => {
    const { m, last } = mgr();
    const a1 = act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L1', startedAt: 10 });
    m.push(a1);
    const a2 = act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'L2', startedAt: 20 });
    m.update(a2);
    assert.equal(last().leading.label, 'L2');
});
```

Note on "trailing-only slot": per spec §4.2 step 3, a trailing-slot activity (like `NotificationProvider`) cannot migrate to leading. The test `remove drops the activity...` above would fail that semantic. **Adjust the last test to match the spec:**

Replace the last block of `remove drops...`:

```javascript
test('remove drops the activity and re-runs assignment', () => {
    const { m, last } = mgr();
    m.push(act({ id: 'a', providerId: 'p', tier: 'persistent', slot: 'leading', label: 'A' }));
    m.push(act({ id: 'b', providerId: 'p', tier: 'persistent', slot: 'trailing', label: 'B' }));
    assert.equal(last().baseState, 'split');
    m.remove('a');
    // b has slot:'trailing' so leading stays empty.
    assert.equal(last().baseState, 'compact');
    assert.equal(last().leading, null);
    assert.equal(last().trailing.id, 'b');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/activity-manager.test.js`
Expected: imports fail with "Cannot find module activity-manager.js".

- [ ] **Step 3: Implement `src/activity-manager.js`**

```javascript
import { emptyViewModel, assertActivity, _now } from './activity.js';

// Pure — no gi imports. Use callback subscribe, not GObject signals.
export class ActivityManager {
    constructor() {
        this._activities = new Map();   // id → Activity
        this._subs = new Set();
        this._hovered = false;
        this._pinned = false;
        this._lastVM = emptyViewModel();
        this._notify();
    }

    // Subscription: invoke immediately with current VM.
    subscribe(fn) {
        this._subs.add(fn);
        fn(this._lastVM);
        return () => this._subs.delete(fn);
    }

    push(activity) {
        assertActivity(activity);
        this._activities.set(activity.id, activity);
        this._notify();
    }

    update(activity) { this.push(activity); }

    remove(id) {
        if (this._activities.delete(id)) this._notify();
    }

    setHover(h) {
        if (this._hovered === !!h) return;
        this._hovered = !!h;
        this._notify();
    }

    setPinned(p) {
        if (this._pinned === !!p) return;
        this._pinned = !!p;
        this._notify();
    }

    // Called by an external ticker to expire transients.
    tick() { this._notify(); }

    destroy() {
        this._subs.clear();
        this._activities.clear();
    }

    // ----- internals -----

    _assign() {
        const now = _now();

        // Drop expired.
        const live = [];
        for (const a of this._activities.values()) {
            if (a.expiresAt !== undefined && a.expiresAt <= now) continue;
            live.push(a);
        }

        const transients = live.filter(a => a.tier === 'transient');
        const persistents = live.filter(a => a.tier === 'persistent');
        const ambients = live.filter(a => a.tier === 'ambient');

        // Flash = newest transient by startedAt (descending).
        transients.sort((x, y) => y.startedAt - x.startedAt);
        const flashing = transients[0] ?? null;

        // Slot assignment over persistents.
        const byPriority = (x, y) => (y.priority - x.priority) || (x.startedAt - y.startedAt);
        const leadingCandidates = persistents.filter(a => a.slot === 'leading' || a.slot === 'either');
        leadingCandidates.sort(byPriority);
        const leading = leadingCandidates[0] ?? null;

        const trailingCandidates = persistents.filter(
            a => (a.slot === 'trailing' || a.slot === 'either') && a !== leading,
        );
        trailingCandidates.sort(byPriority);
        const trailing = trailingCandidates[0] ?? null;

        // Derive baseState.
        let baseState;
        if (this._hovered || this._pinned) baseState = 'expanded';
        else if (leading && trailing) baseState = 'split';
        else if (leading || trailing) baseState = 'compact';
        else baseState = 'idle';

        return {
            baseState,
            leading,
            trailing,
            flashing,
            hovered: this._hovered,
            pinned: this._pinned,
            ambientOverflow: ambients,
        };
    }

    _notify() {
        this._lastVM = Object.freeze(this._assign());
        for (const fn of this._subs) fn(this._lastVM);
    }
}
```

- [ ] **Step 4: Re-run tests**

Run: `node --test tests/activity-manager.test.js`
Expected: all tests pass (12 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/activity-manager.test.js dynamic-island@hacksynth.github.io/src/activity-manager.js
git commit -m "feat(core): ActivityManager with tier/slot assignment"
```

---

## Task 3: Provider contract (`provider-base.js`)

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/provider-base.js`
- Create: `tests/provider-base.test.js`

- [ ] **Step 1: Write failing tests in `tests/provider-base.test.js`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProvider } from '../dynamic-island@hacksynth.github.io/src/providers/provider-base.js';

const stub = {
    id: 'x',
    enable: () => {},
    disable: () => {},
};

test('assertProvider accepts a minimal valid stub', () => {
    assert.doesNotThrow(() => assertProvider(stub));
});

test('assertProvider rejects missing id', () => {
    assert.throws(() => assertProvider({ ...stub, id: undefined }), /id/);
});

test('assertProvider rejects missing enable/disable', () => {
    assert.throws(() => assertProvider({ ...stub, enable: undefined }), /enable/);
    assert.throws(() => assertProvider({ ...stub, disable: undefined }), /disable/);
});
```

- [ ] **Step 2: Run tests — expect import failure**

Run: `node --test tests/provider-base.test.js`
Expected: import error.

- [ ] **Step 3: Implement `src/providers/provider-base.js`**

```javascript
// Pure module — no gi imports. Defines the public Provider contract.
//
// A Provider is an object with:
//   id      : string — stable, lowercase identifier (e.g. "media")
//   enable  : (manager: ActivityManager, settings: Gio.Settings | null) => void
//   disable : () => void
//
// enable() is called once when the extension is enabled. It subscribes to
// its own source (D-Bus / Shell signals / Gio.Settings) and calls
// manager.push / manager.update / manager.remove as events arrive.
//
// disable() MUST release every signal handler, timer, and D-Bus proxy
// it acquired, and remove every activity it pushed.

export function assertProvider(p) {
    if (!p || typeof p !== 'object') throw new Error('Provider must be an object');
    if (typeof p.id !== 'string' || !p.id.length) throw new Error('Provider.id must be a non-empty string');
    if (typeof p.enable !== 'function') throw new Error('Provider.enable must be a function');
    if (typeof p.disable !== 'function') throw new Error('Provider.disable must be a function');
}
```

- [ ] **Step 4: Re-run tests**

Run: `node --test tests/provider-base.test.js`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/provider-base.test.js dynamic-island@hacksynth.github.io/src/providers/provider-base.js
git commit -m "feat(providers): define Provider contract with validator"
```

---

## Task 4: `stylesheet.css` — Adwaita-aligned tokens

**Files:**
- Modify: `dynamic-island@hacksynth.github.io/stylesheet.css`

- [ ] **Step 1: Replace `stylesheet.css` contents**

```css
/* Root pill — mounts in panel center box. */
.dynisland-pill {
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    color: #f0f0f0;
    padding: 4px 12px;
    min-height: 20px;
    transition: all 220ms ease-out;
    /* GNOME CSS does not support backdrop-filter; we lean on base panel blur. */
}

/* State modifiers. */
.dynisland-pill.state-idle {
    padding: 2px 14px;
    background-color: transparent;
    border-color: transparent;
    color: rgba(240, 240, 240, 0.75);
}

.dynisland-pill.state-compact {
    padding: 4px 12px;
    min-width: 120px;
}

.dynisland-pill.state-split {
    padding: 3px 6px;
    min-width: 220px;
}

.dynisland-pill.state-expanded {
    padding: 10px 16px;
    min-width: 320px;
    min-height: 64px;
    border-radius: 18px;
}

.dynisland-pill.flashing {
    background-color: rgba(255, 255, 255, 0.14);
}

/* Split segments. */
.dynisland-segment {
    background-color: rgba(0, 0, 0, 0.35);
    border-radius: 999px;
    padding: 3px 10px;
    color: #f0f0f0;
}

.dynisland-gap { min-width: 6px; }

/* Light theme overrides (gnome-shell adds .light to Main.panel context). */
.light .dynisland-pill {
    background-color: rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.10);
    color: #2e2e2e;
}

.light .dynisland-segment {
    background-color: rgba(0, 0, 0, 0.75);
    color: #f0f0f0;
}

/* Glyph + label alignment. */
.dynisland-glyph {
    icon-size: 16px;
    margin-right: 6px;
}
.dynisland-label { font-size: 11pt; }
.dynisland-sublabel { color: rgba(240, 240, 240, 0.7); font-size: 9pt; }
.light .dynisland-sublabel { color: rgba(0, 0, 0, 0.6); }
```

- [ ] **Step 2: Commit**

```bash
git add dynamic-island@hacksynth.github.io/stylesheet.css
git commit -m "feat(style): Adwaita-aligned pill stylesheet with state modifiers"
```

---

## Task 5: `IslandView` — `St.Widget` renderer

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/island-view.js`

This is a GNOME-bound module — no unit test. Verification via nested shell in Task 9.

- [ ] **Step 1: Implement `src/island-view.js`**

```javascript
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

export const IslandView = GObject.registerClass(
class IslandView extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'dynisland-pill state-idle',
            reactive: true,
            track_hover: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.accessible_role = 2; // ATK_ROLE_PUSH_BUTTON
        this.can_focus = false;

        // Underlying content (compact/split/expanded) stays mounted.
        this._baseLabel = new St.Label({
            style_class: 'dynisland-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._baseLabel);

        // Overlay child for transient flashes — fades over the base content.
        this._flashLabel = new St.Label({
            style_class: 'dynisland-label',
            y_align: Clutter.ActorAlign.CENTER,
            opacity: 0,
            visible: false,
        });
        this.add_child(this._flashLabel);

        this._currentFlashId = null;
    }

    setViewModel(vm) {
        const states = ['idle', 'compact', 'split', 'expanded'];
        for (const s of states) this.remove_style_class_name(`state-${s}`);
        this.add_style_class_name(`state-${vm.baseState}`);

        // Base content always reflects the underlying slots (never cleared by a flash).
        const basePrimary = vm.leading ?? vm.trailing;
        this._baseLabel.text = basePrimary ? this._formatBase(vm, basePrimary) : '';
        this.accessible_name = basePrimary ? basePrimary.label : 'Dynamic Island (idle)';

        // Transient overlay lifecycle.
        if (vm.flashing) {
            if (vm.flashing.id !== this._currentFlashId) {
                this._currentFlashId = vm.flashing.id;
                this._flashLabel.text = vm.flashing.sublabel
                    ? `${vm.flashing.label} — ${vm.flashing.sublabel}`
                    : vm.flashing.label;
                this._flashLabel.show();
                this._flashLabel.ease({
                    opacity: 255,
                    duration: 120,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
                this.add_style_class_name('flashing');
                this.accessible_description = `Flash: ${vm.flashing.label}`;
            }
        } else if (this._currentFlashId) {
            this._currentFlashId = null;
            this._flashLabel.ease({
                opacity: 0,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._flashLabel.hide(),
            });
            this.remove_style_class_name('flashing');
            this.accessible_description = '';
        }
    }

    _formatBase(vm, primary) {
        if (vm.baseState === 'split' && vm.leading && vm.trailing)
            return `${vm.leading.label} · ${vm.trailing.label}`;
        if (vm.baseState === 'expanded' && primary.sublabel)
            return `${primary.label} — ${primary.sublabel}`;
        return primary.label;
    }
});
```

- [ ] **Step 2: Commit**

```bash
git add dynamic-island@hacksynth.github.io/src/island-view.js
git commit -m "feat(view): IslandView St.Widget driven by ViewModel"
```

---

## Task 6: `InteractionController`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/interaction-controller.js`

- [ ] **Step 1: Implement `src/interaction-controller.js`**

```javascript
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class InteractionController {
    constructor(view, manager, extension) {
        this._view = view;
        this._manager = manager;
        this._extension = extension;
        this._handlers = [];
        this._contextMenu = null;

        this._handlers.push(
            view.connect('enter-event', () => { manager.setHover(true); return Clutter.EVENT_PROPAGATE; }),
            view.connect('leave-event', () => { manager.setHover(false); return Clutter.EVENT_PROPAGATE; }),
            view.connect('button-press-event', (_a, ev) => {
                const btn = ev.get_button();
                if (btn === Clutter.BUTTON_PRIMARY) {
                    manager.setPinned(!manager._pinned);
                    return Clutter.EVENT_STOP;
                }
                if (btn === Clutter.BUTTON_SECONDARY) {
                    this._showContextMenu();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }),
            view.connect('key-press-event', (_a, ev) => {
                if (ev.get_key_symbol() === Clutter.KEY_Escape) {
                    manager.setPinned(false);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }),
        );
    }

    _showContextMenu() {
        if (this._contextMenu) { this._contextMenu.destroy(); this._contextMenu = null; }

        const menu = new PopupMenu.PopupMenu(this._view, 0.5, St.Side.TOP);
        Main.uiGroup.add_child(menu.actor);
        menu.actor.hide();

        const prefsItem = new PopupMenu.PopupMenuItem('Preferences…');
        prefsItem.connect('activate', () => this._extension.openPreferences());
        menu.addMenuItem(prefsItem);

        const vm = this._manager._lastVM;
        const current = vm.flashing ?? vm.leading ?? vm.trailing;
        if (current) {
            const disableItem = new PopupMenu.PopupMenuItem(`Disable ${current.providerId}`);
            disableItem.connect('activate', () => {
                const settings = this._extension.getSettings();
                const enabled = new Set(settings.get_strv('providers-enabled'));
                enabled.delete(current.providerId);
                settings.set_strv('providers-enabled', [...enabled]);
            });
            menu.addMenuItem(disableItem);
        }

        menu.open();
        menu.connect('menu-closed', () => { menu.destroy(); this._contextMenu = null; });
        this._contextMenu = menu;
    }

    destroy() {
        if (this._contextMenu) { this._contextMenu.destroy(); this._contextMenu = null; }
        for (const id of this._handlers) this._view.disconnect(id);
        this._handlers = [];
    }
}
```

Note: the `InteractionController` now takes the `extension` instance so right-click actions can reach `openPreferences()` and `getSettings()`. Update `extension.js` accordingly — see the constructor call in Task 9's snippet, which must become `new InteractionController(this._view, this._manager, this)`.

- [ ] **Step 2: Commit**

```bash
git add dynamic-island@hacksynth.github.io/src/interaction-controller.js
git commit -m "feat(view): InteractionController for hover + click-pin + escape"
```

---

## Task 7: `panel-integration.js`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/panel-integration.js`

- [ ] **Step 1: Implement `src/panel-integration.js`**

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class PanelIntegration {
    constructor(view) {
        this._view = view;
        this._dateMenu = Main.panel.statusArea.dateMenu;
        this._dateMenuParent = null;
        this._mounted = false;
    }

    mount() {
        if (this._mounted) return;
        const center = Main.panel._centerBox;

        if (this._dateMenu) {
            this._dateMenuParent = this._dateMenu.container.get_parent();
            if (this._dateMenuParent) this._dateMenu.container.hide();
        }

        center.add_child(this._view);
        this._mounted = true;

        // Warn (don't fight) if other extensions added children.
        const siblings = center.get_children().filter(c => c !== this._view
            && (!this._dateMenu || c !== this._dateMenu.container));
        if (siblings.length > 0) {
            Main.notify('Dynamic Island',
                `Detected ${siblings.length} other center-box extension(s). Layout may be cramped.`);
        }
    }

    unmount() {
        if (!this._mounted) return;
        const center = Main.panel._centerBox;
        if (this._view.get_parent() === center) center.remove_child(this._view);

        if (this._dateMenu && this._dateMenuParent) this._dateMenu.container.show();
        this._mounted = false;
    }

    destroy() { this.unmount(); }
}
```

- [ ] **Step 2: Commit**

```bash
git add dynamic-island@hacksynth.github.io/src/panel-integration.js
git commit -m "feat(view): panel integration with DateMenu hide/restore"
```

---

## Task 8: gschema + compile step

**Files:**
- Create: `dynamic-island@hacksynth.github.io/schemas/org.gnome.shell.extensions.dynamic-island.gschema.xml`

- [ ] **Step 1: Write the schema**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="org.gnome.shell.extensions.dynamic-island"
          path="/org/gnome/shell/extensions/dynamic-island/">

    <!-- Behavior -->
    <key name="tier-order" type="as">
      <default>['transient', 'persistent', 'ambient']</default>
      <summary>Priority order for activity tiers</summary>
    </key>

    <key name="expansion-trigger" type="s">
      <choices><choice value="hover-pin"/><choice value="click-only"/></choices>
      <default>'hover-pin'</default>
      <summary>What causes the pill to expand</summary>
    </key>

    <key name="transient-duration-ms" type="i">
      <range min="500" max="3000"/>
      <default>1500</default>
      <summary>Duration of transient flashes in milliseconds</summary>
    </key>

    <!-- Providers -->
    <key name="providers-enabled" type="as">
      <default>['media', 'notification', 'volume-brightness', 'power', 'keyboard']</default>
      <summary>Enabled provider ids</summary>
    </key>

    <key name="media-show-cover-art" type="b"><default>true</default>
      <summary>Show MPRIS cover art on compact view</summary></key>
    <key name="media-preferred-player" type="s"><default>''</default>
      <summary>Bus name of preferred MPRIS player; empty = most recently played</summary></key>

    <key name="notification-excluded-apps" type="as"><default>[]</default>
      <summary>Desktop file ids whose notifications do not surface in the pill</summary></key>
    <key name="notification-coalesce-threshold" type="i">
      <range min="1" max="20"/><default>3</default>
      <summary>Number of notifications before collapsing to "N new"</summary></key>

    <key name="volume-replace-native-osd" type="b"><default>false</default>
      <summary>Suppress the built-in GNOME OSD while the pill flashes</summary></key>

    <key name="power-low-threshold" type="i">
      <range min="5" max="50"/><default>15</default>
      <summary>Battery percentage below which a warning flashes</summary></key>

    <key name="keyboard-flash-caps-lock" type="b"><default>true</default></key>
    <key name="keyboard-flash-layout-switch" type="b"><default>true</default></key>

    <!-- Appearance -->
    <key name="idle-content" type="s">
      <choices><choice value="clock"/><choice value="blank"/><choice value="custom"/></choices>
      <default>'clock'</default>
      <summary>What the pill shows in idle state</summary>
    </key>

    <key name="idle-custom-text" type="s"><default>''</default>
      <summary>Text shown when idle-content = custom</summary></key>

    <key name="pill-width-multiplier" type="d">
      <range min="0.8" max="1.5"/><default>1.0</default>
      <summary>Scales the pill base width</summary>
    </key>

    <key name="respect-system-theme" type="b"><default>true</default>
      <summary>Use Adwaita tokens that track light/dark preference</summary></key>
  </schema>
</schemalist>
```

- [ ] **Step 2: Compile locally to verify it parses**

Run: `glib-compile-schemas dynamic-island@hacksynth.github.io/schemas/`
Expected: no output. A `gschemas.compiled` file is created (git-ignored).

- [ ] **Step 3: Commit**

```bash
git add dynamic-island@hacksynth.github.io/schemas/org.gnome.shell.extensions.dynamic-island.gschema.xml
git commit -m "feat(settings): gschema with behavior/providers/appearance keys"
```

---

## Task 9: Wire `extension.js` (minimal — no providers yet)

**Files:**
- Modify: `dynamic-island@hacksynth.github.io/extension.js`
- Create: `scripts/verify-checklist.md`

- [ ] **Step 1: Replace `extension.js` contents**

```javascript
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ActivityManager } from './src/activity-manager.js';
import { IslandView } from './src/island-view.js';
import { PanelIntegration } from './src/panel-integration.js';
import { InteractionController } from './src/interaction-controller.js';

export default class DynamicIslandExtension extends Extension {
    enable() {
        this._manager = new ActivityManager();
        this._view = new IslandView();
        this._unsub = this._manager.subscribe(vm => this._view.setViewModel(vm));
        this._panel = new PanelIntegration(this._view);
        this._panel.mount();
        this._interaction = new InteractionController(this._view, this._manager, this);

        // 250ms ticker to expire transients.
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._manager.tick();
            return GLib.SOURCE_CONTINUE;
        });

        this._providers = [];   // Tasks 10-14
    }

    disable() {
        if (this._tickId) { GLib.source_remove(this._tickId); this._tickId = 0; }
        for (const p of (this._providers ?? [])) p.disable();
        this._providers = [];

        this._interaction?.destroy(); this._interaction = null;
        this._panel?.destroy(); this._panel = null;
        this._unsub?.(); this._unsub = null;
        this._view?.destroy(); this._view = null;
        this._manager?.destroy(); this._manager = null;
    }
}
```

- [ ] **Step 2: Create `scripts/verify-checklist.md` with the Task-9 verification block**

```markdown
# Manual Verification Checklist

Launch: `./scripts/run-nested.sh`

## Task 9 — Empty shell
- [ ] Pill appears centered in the top panel (idle state, subtle or invisible).
- [ ] Hovering the pill changes its style class to `state-expanded` (use looking-glass: `Main.panel._centerBox.get_children()[?]`).
- [ ] Clicking the pill toggles `state-expanded` even after pointer leave.
- [ ] Pressing Escape while expanded collapses it.
- [ ] Running `gnome-extensions disable dynamic-island@hacksynth.github.io` restores the DateMenu.
- [ ] `gnome-extensions enable …` + disable cycle five times shows no leaked handlers (looking-glass: `Main.panel._centerBox.get_children().length` returns to original).
```

- [ ] **Step 3: Run the nested shell and tick every checkbox in the Task-9 section**

Run: `./scripts/run-nested.sh` and verify.

- [ ] **Step 4: Commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js scripts/verify-checklist.md
git commit -m "feat(lifecycle): enable/disable wires manager+view+panel+interaction"
```

---

## Task 10: `KeyboardProvider`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/keyboard.js`

- [ ] **Step 1: Implement `src/providers/keyboard.js`**

```javascript
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import { createActivity, _now } from '../activity.js';

export class KeyboardProvider {
    constructor() {
        this.id = 'keyboard';
        this._manager = null;
        this._settings = null;
        this._handlers = [];
        this._sources = null;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._sources = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
        this._handlers.push(
            this._sources.connect('changed::mru-sources', () => this._flashLayoutSwitch()),
            this._sources.connect('changed::current', () => this._flashLayoutSwitch()),
        );

        const keymap = Clutter.get_default_backend().get_default_seat().get_keymap();
        this._handlers.push([keymap, keymap.connect('state-changed', () => this._flashCapsLock(keymap))]);
    }

    disable() {
        if (!this._sources) return;
        for (const h of this._handlers) {
            if (Array.isArray(h)) h[0].disconnect(h[1]);
            else this._sources.disconnect(h);
        }
        this._handlers = [];
        this._sources = null;
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _flashCapsLock(keymap) {
        if (!this._settings?.get_boolean('keyboard-flash-caps-lock')) return;
        const on = keymap.get_caps_lock_state();
        this._push(`Caps Lock ${on ? 'on' : 'off'}`);
    }

    _flashLayoutSwitch() {
        if (!this._settings?.get_boolean('keyboard-flash-layout-switch')) return;
        const sources = this._sources.get_value('mru-sources').deepUnpack();
        if (!sources.length) return;
        const [, id] = sources[0];
        this._push(`Layout · ${id}`);
    }

    _push(label) {
        const duration = (this._settings?.get_int('transient-duration-ms') ?? 1500) * 1000;
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            label,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
```

- [ ] **Step 2: Wire into `extension.js` `enable()`**

Add just before the `this._providers = []` line:

```javascript
import { KeyboardProvider } from './src/providers/keyboard.js';
```

And replace the `this._providers = [];` line with:

```javascript
this._providers = [new KeyboardProvider()];
for (const p of this._providers) p.enable(this._manager, this.getSettings());
```

- [ ] **Step 3: Append Task-10 verification block to `scripts/verify-checklist.md`**

```markdown
## Task 10 — Keyboard provider
- [ ] Pressing Caps Lock toggles a flash labelled "Caps Lock on" / "Caps Lock off".
- [ ] Super+Space (or configured layout-switch shortcut) shows a "Layout · <id>" flash.
- [ ] Disabling the "keyboard-flash-caps-lock" key via `dconf write` suppresses the caps flash.
```

- [ ] **Step 4: Verify in nested shell, then commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js \
        dynamic-island@hacksynth.github.io/src/providers/keyboard.js \
        scripts/verify-checklist.md
git commit -m "feat(providers): keyboard provider (caps lock + layout switch)"
```

---

## Task 11: `PowerProvider`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/power.js`

- [ ] **Step 1: Implement `src/providers/power.js`**

```javascript
import Gio from 'gi://Gio';
import { createActivity, _now } from '../activity.js';

const UPOWER_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';
const UPOWER_IFACE = 'org.freedesktop.UPower.Device';

export class PowerProvider {
    constructor() {
        this.id = 'power';
        this._manager = null;
        this._settings = null;
        this._proxy = null;
        this._propsHandler = 0;
        this._lastPlugged = null;
    }

    async enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._proxy = new Gio.DBusProxy({
            g_connection: Gio.DBus.system,
            g_name: 'org.freedesktop.UPower',
            g_object_path: UPOWER_PATH,
            g_interface_name: UPOWER_IFACE,
            g_flags: Gio.DBusProxyFlags.NONE,
        });
        try { await this._proxy.init_async(0, null); } catch (_) { return; }

        this._propsHandler = this._proxy.connect('g-properties-changed', () => this._refresh());
        this._refresh();
    }

    disable() {
        if (this._proxy && this._propsHandler) this._proxy.disconnect(this._propsHandler);
        this._proxy = null;
        this._propsHandler = 0;
        this._manager?.remove(`${this.id}:ambient`);
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _refresh() {
        const state = this._proxy.get_cached_property('State')?.deepUnpack();  // 1=charging,2=discharging,4=fully
        const pct = this._proxy.get_cached_property('Percentage')?.deepUnpack();
        if (state === undefined || pct === undefined) return;

        // Ambient steady-state entry (shown only in expanded overflow).
        this._manager.update(createActivity({
            id: `${this.id}:ambient`,
            providerId: this.id,
            tier: 'ambient',
            slot: 'either',
            label: `${Math.round(pct)}%`,
            sublabel: state === 1 ? 'Charging' : state === 4 ? 'Full' : 'On battery',
        }));

        // Plug/unplug transient.
        const plugged = (state === 1 || state === 4);
        if (this._lastPlugged !== null && plugged !== this._lastPlugged) {
            this._flash(plugged ? 'Charger connected' : 'Charger disconnected');
        }
        this._lastPlugged = plugged;

        // Low-battery transient.
        const threshold = this._settings?.get_int('power-low-threshold') ?? 15;
        if (!plugged && pct <= threshold) this._flash(`Battery low — ${Math.round(pct)}%`);
    }

    _flash(label) {
        const duration = (this._settings?.get_int('transient-duration-ms') ?? 1500) * 1000;
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            label,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
```

- [ ] **Step 2: Wire into `extension.js` providers list**

Import at top:
```javascript
import { PowerProvider } from './src/providers/power.js';
```
Change providers line:
```javascript
this._providers = [new KeyboardProvider(), new PowerProvider()];
```

- [ ] **Step 3: Append verification block**

```markdown
## Task 11 — Power provider
- [ ] Plug/unplug the charger (or simulate with `upower -d` + a live session) flashes "Charger connected/disconnected".
- [ ] When battery < 15%, a "Battery low — N%" flash appears on each update.
- [ ] Expanded pill shows an ambient row "N% · Charging/Full/On battery".
```

- [ ] **Step 4: Verify then commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js \
        dynamic-island@hacksynth.github.io/src/providers/power.js \
        scripts/verify-checklist.md
git commit -m "feat(providers): power provider with transient + ambient entries"
```

---

## Task 12: `VolumeBrightnessProvider`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/volume-brightness.js`

- [ ] **Step 1: Implement `src/providers/volume-brightness.js`**

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import { createActivity, _now } from '../activity.js';

export class VolumeBrightnessProvider {
    constructor() {
        this.id = 'volume-brightness';
        this._manager = null;
        this._settings = null;
        this._origShow = null;
        this._volControl = null;
        this._volHandler = 0;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._volControl = Volume.getMixerControl();
        this._volHandler = this._volControl.connect('default-sink-volume-changed',
            (_c, sink) => this._flashVolume(sink));

        if (settings?.get_boolean('volume-replace-native-osd')) {
            const osd = Main.osdWindowManager;
            this._origShow = osd.show.bind(osd);
            osd.show = (...args) => {
                // Capture level and flash via our pill; suppress the native window.
                const level = args[2];
                if (Number.isFinite(level)) this._flashGeneric('Volume', Math.round(level * 100));
            };
        }
    }

    disable() {
        if (this._volControl && this._volHandler) this._volControl.disconnect(this._volHandler);
        this._volControl = null;
        this._volHandler = 0;
        if (this._origShow) { Main.osdWindowManager.show = this._origShow; this._origShow = null; }
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _flashVolume(sink) {
        if (!sink) return;
        const pct = Math.round((sink.volume / this._volControl.get_vol_max_norm()) * 100);
        this._flashGeneric(sink.is_muted ? 'Muted' : 'Volume', pct);
    }

    _flashGeneric(name, pct) {
        const duration = (this._settings?.get_int('transient-duration-ms') ?? 1500) * 1000;
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            label: `${name} ${pct}%`,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
```

- [ ] **Step 2: Wire into `extension.js`**

```javascript
import { VolumeBrightnessProvider } from './src/providers/volume-brightness.js';
// ...
this._providers = [
    new KeyboardProvider(),
    new PowerProvider(),
    new VolumeBrightnessProvider(),
];
```

- [ ] **Step 3: Append verification block**

```markdown
## Task 12 — Volume/Brightness provider
- [ ] Pressing volume keys shows a "Volume N%" flash.
- [ ] Muting flashes "Muted 0%".
- [ ] With `volume-replace-native-osd=false` (default), the native OSD still appears alongside.
- [ ] Flipping to `true`, the native OSD is suppressed and only our pill flashes.
```

- [ ] **Step 4: Verify and commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js \
        dynamic-island@hacksynth.github.io/src/providers/volume-brightness.js \
        scripts/verify-checklist.md
git commit -m "feat(providers): volume/brightness transient flashes + OSD override"
```

---

## Task 13: `MediaProvider`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/media.js`

- [ ] **Step 1: Implement `src/providers/media.js`**

```javascript
import Gio from 'gi://Gio';
import { createActivity, _now } from '../activity.js';

const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

export class MediaProvider {
    constructor() {
        this.id = 'media';
        this._manager = null;
        this._settings = null;
        this._dbus = null;
        this._busHandler = 0;
        this._players = new Map();   // busName → { proxy, propsHandler }
    }

    async enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._dbus = Gio.DBus.session;

        const watcher = this._dbus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (_c, _s, _p, _i, _sig, params) => {
                const [name, oldOwner, newOwner] = params.deepUnpack();
                if (!name.startsWith(MPRIS_BUS_PREFIX)) return;
                if (newOwner && !oldOwner) this._addPlayer(name);
                else if (oldOwner && !newOwner) this._removePlayer(name);
            });
        this._busHandler = watcher;

        const [names] = await this._dbus.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'ListNames', null, null, Gio.DBusCallFlags.NONE, -1, null).then(r => r.deepUnpack());

        for (const n of names) if (n.startsWith(MPRIS_BUS_PREFIX)) this._addPlayer(n);
    }

    disable() {
        if (this._busHandler) this._dbus.signal_unsubscribe(this._busHandler);
        this._busHandler = 0;
        for (const [name, entry] of this._players) {
            entry.proxy.disconnect(entry.propsHandler);
            this._manager?.remove(`${this.id}:${name}`);
        }
        this._players.clear();
        this._manager = null;
    }

    async _addPlayer(busName) {
        const proxy = new Gio.DBusProxy({
            g_connection: this._dbus,
            g_name: busName,
            g_object_path: MPRIS_PATH,
            g_interface_name: PLAYER_IFACE,
            g_flags: Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES,
        });
        try { await proxy.init_async(0, null); } catch (_) { return; }

        const propsHandler = proxy.connect('g-properties-changed', () => this._refresh(busName, proxy));
        this._players.set(busName, { proxy, propsHandler });
        this._refresh(busName, proxy);
    }

    _removePlayer(busName) {
        const entry = this._players.get(busName);
        if (entry) entry.proxy.disconnect(entry.propsHandler);
        this._players.delete(busName);
        this._manager?.remove(`${this.id}:${busName}`);
    }

    _refresh(busName, proxy) {
        const status = proxy.get_cached_property('PlaybackStatus')?.deepUnpack();
        const metadata = proxy.get_cached_property('Metadata')?.deepUnpack() ?? {};
        const title = metadata['xesam:title']?.deepUnpack?.() ?? metadata['xesam:title'] ?? '';
        const artistArr = metadata['xesam:artist']?.deepUnpack?.() ?? metadata['xesam:artist'] ?? [];
        const artist = Array.isArray(artistArr) ? artistArr.join(', ') : String(artistArr);

        if (status !== 'Playing' || !title) {
            this._manager.remove(`${this.id}:${busName}`);
            return;
        }

        this._manager.update(createActivity({
            id: `${this.id}:${busName}`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'leading',
            priority: Date.now(),   // most recently active wins
            label: title,
            sublabel: artist,
        }));
    }
}
```

- [ ] **Step 2: Wire into `extension.js`**

```javascript
import { MediaProvider } from './src/providers/media.js';
// ...
this._providers = [
    new KeyboardProvider(),
    new PowerProvider(),
    new VolumeBrightnessProvider(),
    new MediaProvider(),
];
```

- [ ] **Step 3: Append verification block**

```markdown
## Task 13 — Media provider
- [ ] Start a song in any MPRIS-capable player (Spotify, mpv, rhythmbox); pill shows the title within ~300ms.
- [ ] Pause → pill returns to idle; play → pill returns to compact.
- [ ] Second player started → most recently active wins via `priority` tie-break.
- [ ] Killing the player (e.g., SIGKILL) cleanly removes the pill content without console errors.
```

- [ ] **Step 4: Verify and commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js \
        dynamic-island@hacksynth.github.io/src/providers/media.js \
        scripts/verify-checklist.md
git commit -m "feat(providers): MPRIS2 media provider with name-owner tracking"
```

---

## Task 14: `NotificationProvider`

**Files:**
- Create: `dynamic-island@hacksynth.github.io/src/providers/notification.js`

- [ ] **Step 1: Implement `src/providers/notification.js`**

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { createActivity } from '../activity.js';

export class NotificationProvider {
    constructor() {
        this.id = 'notification';
        this._manager = null;
        this._settings = null;
        this._tray = null;
        this._handlers = [];
        this._active = new Set();   // notification objects currently tracked
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._tray = Main.messageTray;

        this._handlers.push(
            this._tray.connect('source-added', (_t, source) => this._bindSource(source)),
        );
        for (const src of this._tray.getSources()) this._bindSource(src);
    }

    disable() {
        if (!this._tray) return;
        for (const h of this._handlers) this._tray.disconnect(h);
        this._handlers = [];
        this._active.clear();
        this._manager?.remove(`${this.id}:aggregate`);
        this._manager = null;
        this._tray = null;
    }

    _bindSource(source) {
        source.connect('notification-added', (_s, n) => {
            const excluded = this._settings?.get_strv('notification-excluded-apps') ?? [];
            if (source.app?.get_id && excluded.includes(source.app.get_id())) return;

            this._active.add(n);
            n.connect('destroy', () => { this._active.delete(n); this._rebuild(); });
            this._rebuild();
        });
    }

    _rebuild() {
        const n = this._active.size;
        if (n === 0) {
            this._manager.remove(`${this.id}:aggregate`);
            return;
        }

        const threshold = this._settings?.get_int('notification-coalesce-threshold') ?? 3;
        let label, sublabel;
        if (n < threshold) {
            const latest = [...this._active].pop();
            label = latest.title ?? latest.source?.title ?? 'Notification';
            sublabel = latest.bannerBodyText ?? latest.body ?? '';
        } else {
            label = `${n} new`;
            sublabel = 'Notifications';
        }

        this._manager.update(createActivity({
            id: `${this.id}:aggregate`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'trailing',
            label, sublabel,
        }));
    }
}
```

- [ ] **Step 2: Wire into `extension.js`**

```javascript
import { NotificationProvider } from './src/providers/notification.js';
// ...
this._providers = [
    new KeyboardProvider(),
    new PowerProvider(),
    new VolumeBrightnessProvider(),
    new MediaProvider(),
    new NotificationProvider(),
];
```

- [ ] **Step 3: Append verification block**

```markdown
## Task 14 — Notification provider
- [ ] `notify-send "Hello" "World"` puts "Hello" into the trailing slot.
- [ ] Sending three more notifications flips the label to "4 new · Notifications".
- [ ] Dismissing all notifications returns the pill to compact (with media if playing) or idle.
- [ ] Adding the sending app to `notification-excluded-apps` via dconf causes subsequent notifications from that app to not appear.
```

- [ ] **Step 4: Verify and commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js \
        dynamic-island@hacksynth.github.io/src/providers/notification.js \
        scripts/verify-checklist.md
git commit -m "feat(providers): notification provider with coalescing + exclusion"
```

---

## Task 15: `prefs.js` — Adwaita preferences window

**Files:**
- Create: `dynamic-island@hacksynth.github.io/prefs.js`

- [ ] **Step 1: Implement `prefs.js`**

```javascript
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class DynamicIslandPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({ title: 'Dynamic Island', icon_name: 'preferences-system-symbolic' });

        // ---- Behavior group ----
        const behavior = new Adw.PreferencesGroup({ title: 'Behavior' });
        behavior.add(this._comboRow(settings, 'expansion-trigger', 'Expansion trigger',
            [['hover-pin', 'Hover + click to pin'], ['click-only', 'Click only']]));
        behavior.add(this._spinRow(settings, 'transient-duration-ms', 'Transient flash duration (ms)', 500, 3000, 50));

        // Tier order: comma-separated entry (drag-sortable Adw.Row does not exist as of
        // libadwaita 1.6; the simplest honest surface is a validated text entry that
        // accepts a permutation of the three tiers).
        const tierRow = new Adw.EntryRow({ title: 'Tier order (comma-separated)' });
        tierRow.text = settings.get_strv('tier-order').join(', ');
        tierRow.connect('changed', () => {
            const parts = tierRow.text.split(',').map(s => s.trim()).filter(Boolean);
            const valid = ['transient', 'persistent', 'ambient'];
            if (parts.length === 3 && parts.every(p => valid.includes(p)) && new Set(parts).size === 3)
                settings.set_strv('tier-order', parts);
        });
        behavior.add(tierRow);

        page.add(behavior);

        // ---- Providers group ----
        const providers = new Adw.PreferencesGroup({ title: 'Providers' });
        for (const id of ['media', 'notification', 'volume-brightness', 'power', 'keyboard']) {
            providers.add(this._providerToggleRow(settings, id));
        }
        page.add(providers);

        // ---- Appearance group ----
        const appearance = new Adw.PreferencesGroup({ title: 'Appearance' });
        appearance.add(this._comboRow(settings, 'idle-content', 'Idle content',
            [['clock', 'Clock'], ['blank', 'Blank'], ['custom', 'Custom text']]));
        appearance.add(this._entryRow(settings, 'idle-custom-text', 'Custom idle text'));
        appearance.add(this._scaleRow(settings, 'pill-width-multiplier', 'Pill width multiplier', 0.8, 1.5, 0.05));
        page.add(appearance);

        window.add(page);
    }

    _providerToggleRow(settings, id) {
        const row = new Adw.ActionRow({ title: id });
        const sw = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        const enabled = settings.get_strv('providers-enabled');
        sw.active = enabled.includes(id);
        sw.connect('state-set', (_, state) => {
            const cur = new Set(settings.get_strv('providers-enabled'));
            if (state) cur.add(id); else cur.delete(id);
            settings.set_strv('providers-enabled', [...cur]);
            return false;
        });
        row.add_suffix(sw);
        row.activatable_widget = sw;
        return row;
    }

    _comboRow(settings, key, title, choices) {
        const model = new Gtk.StringList();
        for (const [, label] of choices) model.append(label);
        const row = new Adw.ComboRow({ title, model });
        const ids = choices.map(c => c[0]);
        row.selected = Math.max(0, ids.indexOf(settings.get_string(key)));
        row.connect('notify::selected', () => settings.set_string(key, ids[row.selected]));
        return row;
    }

    _spinRow(settings, key, title, min, max, step) {
        const row = new Adw.SpinRow({ title,
            adjustment: new Gtk.Adjustment({ lower: min, upper: max, step_increment: step }),
        });
        row.value = settings.get_int(key);
        row.connect('notify::value', () => settings.set_int(key, row.value));
        return row;
    }

    _scaleRow(settings, key, title, min, max, step) {
        const row = new Adw.SpinRow({ title, digits: 2,
            adjustment: new Gtk.Adjustment({ lower: min, upper: max, step_increment: step }),
        });
        row.value = settings.get_double(key);
        row.connect('notify::value', () => settings.set_double(key, row.value));
        return row;
    }

    _entryRow(settings, key, title) {
        const row = new Adw.EntryRow({ title });
        row.text = settings.get_string(key);
        row.connect('changed', () => settings.set_string(key, row.text));
        return row;
    }
}
```

- [ ] **Step 2: Append verification block**

```markdown
## Task 15 — Preferences window
- [ ] `gnome-extensions prefs dynamic-island@hacksynth.github.io` opens the preferences window.
- [ ] Behavior group: Expansion trigger combo + transient duration spinner.
- [ ] Providers group: five toggle rows, each toggle updates dconf `providers-enabled`.
- [ ] Appearance group: idle-content combo, custom-text entry, pill-width spin.
- [ ] Changing any value updates the live pill without a restart (verified via looking-glass).
```

- [ ] **Step 3: Verify and commit**

```bash
git add dynamic-island@hacksynth.github.io/prefs.js scripts/verify-checklist.md
git commit -m "feat(prefs): Adw.PreferencesWindow with Behavior/Providers/Appearance"
```

---

## Task 16: Honor `providers-enabled` in `extension.js`

**Files:**
- Modify: `dynamic-island@hacksynth.github.io/extension.js`

- [ ] **Step 1: Replace the provider construction block**

Replace:

```javascript
this._providers = [
    new KeyboardProvider(),
    new PowerProvider(),
    new VolumeBrightnessProvider(),
    new MediaProvider(),
    new NotificationProvider(),
];
for (const p of this._providers) p.enable(this._manager, this.getSettings());
```

With:

```javascript
const all = {
    'keyboard': KeyboardProvider,
    'power': PowerProvider,
    'volume-brightness': VolumeBrightnessProvider,
    'media': MediaProvider,
    'notification': NotificationProvider,
};
const settings = this.getSettings();
const enabled = new Set(settings.get_strv('providers-enabled'));
this._providers = [];
for (const [id, Cls] of Object.entries(all)) {
    if (enabled.has(id)) {
        const p = new Cls();
        p.enable(this._manager, settings);
        this._providers.push(p);
    }
}

this._settingsHandler = settings.connect('changed::providers-enabled', () => {
    // Rebuild the provider set without a full extension restart.
    for (const p of this._providers) p.disable();
    const now = new Set(settings.get_strv('providers-enabled'));
    this._providers = [];
    for (const [id, Cls] of Object.entries(all)) {
        if (now.has(id)) {
            const p = new Cls();
            p.enable(this._manager, settings);
            this._providers.push(p);
        }
    }
});
```

- [ ] **Step 2: In `disable()`, disconnect the settings handler**

Add at the top of `disable()` (after the tick removal):

```javascript
if (this._settingsHandler) {
    this.getSettings().disconnect(this._settingsHandler);
    this._settingsHandler = 0;
}
```

- [ ] **Step 3: Append verification block**

```markdown
## Task 16 — Settings-driven providers
- [ ] Toggling a provider off in prefs removes it live (pill stops reflecting its events).
- [ ] Toggling it back on re-enables without a disable/enable cycle.
- [ ] `gnome-extensions disable …` on the extension disconnects the settings handler (no leaks on re-enable).
```

- [ ] **Step 4: Verify and commit**

```bash
git add dynamic-island@hacksynth.github.io/extension.js scripts/verify-checklist.md
git commit -m "feat(lifecycle): honor providers-enabled reactively"
```

---

## Task 17: Provider contract docs

**Files:**
- Create: `dynamic-island@hacksynth.github.io/docs/provider-contract.md`

- [ ] **Step 1: Write the contract document**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add dynamic-island@hacksynth.github.io/docs/provider-contract.md
git commit -m "docs: provider contract for contributors"
```

---

## Task 18: README and final end-to-end verification

**Files:**
- Create: `README.md`
- Append: `scripts/verify-checklist.md`

- [ ] **Step 1: Create a minimal `README.md`**

```markdown
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
```

- [ ] **Step 2: Append final verification block**

```markdown
## Task 18 — End-to-end
- [ ] Clean session: `gnome-extensions reset dynamic-island@hacksynth.github.io`, then enable.
- [ ] Start media playing + trigger a notification → split state shows title (leading) + notification (trailing).
- [ ] Bump volume during split → transient flash overlays without dropping either slot; slot state returns after expiry.
- [ ] Run `node --test tests/` → all green.
- [ ] Five enable/disable cycles leave zero leaked children in `Main.panel._centerBox` (looking-glass).
```

- [ ] **Step 3: Run the full test suite + manual walkthrough**

```
node --test tests/
./scripts/run-nested.sh
```

- [ ] **Step 4: Commit**

```bash
git add README.md scripts/verify-checklist.md
git commit -m "chore: README + final verification checklist"
```

---

## Known v1 Simplifications vs. Spec

Callouts the reviewer should know about:

1. **`tier-order` setting is persisted but not runtime-consumed in v1.** The three tiers have distinct roles (transient = overlay, persistent = slot-filling, ambient = overflow), so reordering them is semantically unclear. The setting exists for forward compatibility; spec §6.1 will be revisited before v2.
2. **Expansion-trigger pref (`hover-pin` vs `click-only`) is persisted but the `InteractionController` always honors hover.** Wiring it through is a one-boolean change but was out of scope for this plan's tasks; fold it in as a follow-up.
3. **Animation durations are the CSS-declared 220 ms from Task 4 + hard-coded 120 ms fade in Task 5.** The spec §4.5 values are implemented but not yet settings-bound.
4. **Appearance prefs (`idle-content`, `idle-custom-text`, `pill-width-multiplier`) are persisted in the gschema but not yet consumed by `IslandView`.** The plumbing path is straightforward (`IslandView.setSettings(settings)` + branch in `setViewModel`'s idle case), but was left out of v1 to keep the initial surface small. Wire them in as follow-up.

## Post-plan checklist (for agents)

After completing all 19 tasks (0–18):

- `node --test tests/` → passes (activity, activity-manager, provider-base).
- `scripts/verify-checklist.md` → every Task-N section has every box ticked in your session transcript.
- `git log --oneline` shows one commit per task (roughly 19 commits, all following the `<type>(<scope>): <message>` convention above).
- No file in `src/` exceeds ~250 lines.
