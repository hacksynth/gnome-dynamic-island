import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverlayRect, _internals } from '../dynamic-island@hacksynth.github.io/src/overlay-geometry.js';

const { DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT, DEFAULT_SEAM_OVERLAP } = _internals;

const MONITOR_1080P = { x: 0, y: 0, width: 1920, height: 1080 };

function makePill({ x, width = 120, y = 4, height = 28 }) {
    return { x, y, width, height };
}

test('centered pill → overlay centered under its midpoint', () => {
    const pill = makePill({ x: (1920 - 120) / 2, width: 120 }); // centered
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: MONITOR_1080P,
    });
    // With minWidth 320 applied, overlay width is 320.
    assert.equal(rect.width, DEFAULT_MIN_WIDTH);
    // Centered under pill midpoint = 1920/2 = 960.
    assert.equal(rect.x + rect.width / 2, 960);
    assert.equal(rect.y, 32 - DEFAULT_SEAM_OVERLAP);
    assert.equal(rect.height, DEFAULT_MIN_HEIGHT);
});

test('pill near right edge → overlay clamped to monitor right', () => {
    // pill right edge at 1910 → ideal centered overlay would extend past monitor.
    const pill = makePill({ x: 1790, width: 120 }); // mid = 1850
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: MONITOR_1080P,
    });
    // Overlay should be clamped so its right edge == 1920.
    assert.equal(rect.x + rect.width, MONITOR_1080P.x + MONITOR_1080P.width);
});

test('pill near left edge → overlay clamped to monitor left', () => {
    const pill = makePill({ x: 0, width: 120 }); // mid = 60
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: MONITOR_1080P,
    });
    assert.equal(rect.x, MONITOR_1080P.x);
});

test('wide pill larger than minWidth → overlay matches pill width', () => {
    const pill = makePill({ x: 500, width: 500 });
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: MONITOR_1080P,
    });
    assert.equal(rect.width, 500);
});

test('maxWidth honored even when pill is huge', () => {
    const pill = makePill({ x: 100, width: 1800 });
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: MONITOR_1080P,
        desired: { maxWidth: 600 },
    });
    assert.equal(rect.width, 600);
});

test('monitor offset (secondary monitor to the right) is respected', () => {
    const monitor2 = { x: 1920, y: 0, width: 2560, height: 1440 };
    const pill = makePill({ x: 1920 + (2560 - 120) / 2, width: 120 });
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 32,
        monitor: monitor2,
    });
    // Overlay stays within monitor2.
    assert.ok(rect.x >= monitor2.x, `x ${rect.x} >= ${monitor2.x}`);
    assert.ok(rect.x + rect.width <= monitor2.x + monitor2.width);
    // And centered under pill mid = 1920 + 2560/2 = 3200
    assert.equal(rect.x + rect.width / 2, 3200);
});

test('monitor offset (primary starting at y>0, vertical stacking) reflected in y', () => {
    const monitor = { x: 0, y: 200, width: 1920, height: 1080 };
    const pill = makePill({ x: 900, width: 120, y: 204 });
    const rect = computeOverlayRect({
        pill,
        panelBottomY: 232,
        monitor,
    });
    assert.equal(rect.y, 232 - DEFAULT_SEAM_OVERLAP);
});

test('custom seamOverlap honored', () => {
    const rect = computeOverlayRect({
        pill: makePill({ x: 900, width: 120 }),
        panelBottomY: 100,
        monitor: MONITOR_1080P,
        desired: { seamOverlap: 0 },
    });
    assert.equal(rect.y, 100);
});

test('invalid pill throws', () => {
    assert.throws(() => computeOverlayRect({
        pill: { x: 0, y: 0, width: 'bad', height: 10 },
        panelBottomY: 0,
        monitor: MONITOR_1080P,
    }), /pill\.width must be finite/);
});

test('non-finite panelBottomY throws', () => {
    assert.throws(() => computeOverlayRect({
        pill: makePill({ x: 0, width: 120 }),
        panelBottomY: NaN,
        monitor: MONITOR_1080P,
    }), /panelBottomY must be finite/);
});

test('degenerate monitor narrower than overlay falls back safely', () => {
    // If monitor is narrower than overlay width, x should clamp to monitor.x (no negative width).
    const tinyMonitor = { x: 100, y: 0, width: 200, height: 1000 };
    const rect = computeOverlayRect({
        pill: makePill({ x: 150, width: 50 }),
        panelBottomY: 32,
        monitor: tinyMonitor,
    });
    // Width gets clamped to monitor.width (200).
    assert.equal(rect.width, 200);
    // X clamped to monitor.x.
    assert.equal(rect.x, 100);
});
