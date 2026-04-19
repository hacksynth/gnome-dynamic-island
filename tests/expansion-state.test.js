import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveExpansion, mergedHover } from '../dynamic-island@hacksynth.github.io/src/expansion-state.js';

test('all false → closed and unmounted', () => {
    const r = deriveExpansion({ pillHover: false, overlayHover: false, pinned: false, animating: false });
    assert.equal(r.target, 'closed');
    assert.equal(r.shouldMount, false);
});

test('pillHover true → open and mounted', () => {
    const r = deriveExpansion({ pillHover: true, overlayHover: false, pinned: false, animating: false });
    assert.equal(r.target, 'open');
    assert.equal(r.shouldMount, true);
});

test('overlayHover true → open (overlay keeps itself alive)', () => {
    const r = deriveExpansion({ pillHover: false, overlayHover: true, pinned: false, animating: false });
    assert.equal(r.target, 'open');
    assert.equal(r.shouldMount, true);
});

test('pinned true with no hover → still open', () => {
    const r = deriveExpansion({ pillHover: false, overlayHover: false, pinned: true, animating: false });
    assert.equal(r.target, 'open');
    assert.equal(r.shouldMount, true);
});

test('both hovers true → open (OR not AND)', () => {
    const r = deriveExpansion({ pillHover: true, overlayHover: true, pinned: false, animating: false });
    assert.equal(r.target, 'open');
});

test('closing animation keeps actor mounted even though target is closed', () => {
    const r = deriveExpansion({ pillHover: false, overlayHover: false, pinned: false, animating: true });
    assert.equal(r.target, 'closed');
    assert.equal(r.shouldMount, true);
});

test('undefined inputs treated as falsy', () => {
    // Defensive: controller may not have initialized every field yet.
    const r = deriveExpansion({});
    assert.equal(r.target, 'closed');
    assert.equal(r.shouldMount, false);
});

test('no argument does not throw', () => {
    const r = deriveExpansion();
    assert.equal(r.target, 'closed');
    assert.equal(r.shouldMount, false);
});

test('mergedHover OR logic', () => {
    assert.equal(mergedHover({ pillHover: false, overlayHover: false }), false);
    assert.equal(mergedHover({ pillHover: true, overlayHover: false }), true);
    assert.equal(mergedHover({ pillHover: false, overlayHover: true }), true);
    assert.equal(mergedHover({ pillHover: true, overlayHover: true }), true);
    assert.equal(mergedHover({}), false);
    assert.equal(mergedHover(), false);
});
