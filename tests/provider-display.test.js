import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerDisplayName } from '../dynamic-island@hacksynth.github.io/src/provider-display.js';

// In tests we pass an identity function in place of gettext — the point of
// the module is that the mapping is dictionary-based; the translation layer
// is the caller's concern.
const identity = s => s;

test('providerDisplayName returns a friendly label for each known id', () => {
    assert.equal(providerDisplayName('media', identity), 'Media');
    assert.equal(providerDisplayName('notification', identity), 'Notifications');
    assert.equal(providerDisplayName('volume-brightness', identity), 'Volume / Brightness');
    assert.equal(providerDisplayName('power', identity), 'Power');
    assert.equal(providerDisplayName('keyboard', identity), 'Keyboard');
});

test('providerDisplayName falls back to the raw id for unknown providers', () => {
    assert.equal(providerDisplayName('some-future-provider', identity), 'some-future-provider');
});

test('providerDisplayName routes the label through the provided gettext', () => {
    const fake = s => `<${s}>`;
    assert.equal(providerDisplayName('media', fake), '<Media>');
});
