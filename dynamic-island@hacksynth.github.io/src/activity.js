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
