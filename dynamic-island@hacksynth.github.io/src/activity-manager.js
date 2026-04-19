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

    isHovered() { return this._hovered; }
    isPinned() { return this._pinned; }

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
            ambientOverflow: Object.freeze(ambients),
        };
    }

    _notify() {
        this._lastVM = Object.freeze(this._assign());
        for (const fn of this._subs) fn(this._lastVM);
    }
}
