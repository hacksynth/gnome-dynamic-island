import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveIdleText } from '../dynamic-island@hacksynth.github.io/src/idle-content.js';

test('resolveIdleText uses the clock for clock mode', () => {
    assert.equal(resolveIdleText('clock', 'Hello', '09:41'), '09:41');
});

test('resolveIdleText returns blank for blank mode', () => {
    assert.equal(resolveIdleText('blank', 'Hello', '09:41'), '');
});

test('resolveIdleText uses custom text for custom mode', () => {
    assert.equal(resolveIdleText('custom', 'Focus', '09:41'), 'Focus');
});

test('resolveIdleText falls back to the clock for unknown modes', () => {
    assert.equal(resolveIdleText('future-mode', 'Hello', '09:41'), '09:41');
});
