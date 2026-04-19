import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const POT_PATH = 'po/dynamic-island.pot';
const ZH_PATH = 'po/zh_CN.po';

function parseMsgids(poContents) {
    // Extract every `msgid "…"` that is followed (after optional `msgstr[n]`
    // continuations) by at least one non-header `msgstr "…"` with non-empty
    // content. We only need the msgid strings for the spot-check, so return
    // the set of msgids (ignoring the header empty-msgid).
    const ids = new Set();
    const re = /^msgid\s+"((?:[^"\\]|\\.)*)"/gm;
    let m;
    while ((m = re.exec(poContents)) !== null) {
        if (m[1].length > 0) ids.add(m[1]);
    }
    return ids;
}

function assertNoUntranslated(path) {
    const contents = readFileSync(path, 'utf8');
    // Split the file into records separated by blank lines. The header is the
    // first record and is the only one allowed to have `msgstr ""`.
    const records = contents.split(/\n\n+/);
    const failures = [];
    records.forEach((rec, idx) => {
        if (idx === 0) return; // header
        const msgidLine = /^msgid\s+"((?:[^"\\]|\\.)*)"/m.exec(rec);
        if (!msgidLine || msgidLine[1].length === 0) return; // obsolete / header-like
        // For simple (non-plural) entries: msgstr "..."
        const simple = /^msgstr\s+"((?:[^"\\]|\\.)*)"/m.exec(rec);
        const pluralEntries = [...rec.matchAll(/^msgstr\[\d+\]\s+"((?:[^"\\]|\\.)*)"/gm)];
        if (pluralEntries.length > 0) {
            pluralEntries.forEach((pe, pi) => {
                if (pe[1].length === 0) failures.push(`${msgidLine[1]} (plural form ${pi})`);
            });
        } else if (simple && simple[1].length === 0) {
            failures.push(msgidLine[1]);
        }
    });
    assert.deepEqual(failures, [], `untranslated entries in ${path}: ${failures.join(', ')}`);
}

test('po/dynamic-island.pot exists', () => {
    assert.ok(existsSync(POT_PATH), `${POT_PATH} missing — run: npm run i18n:update`);
});

test('po/dynamic-island.pot contains a stable subset of expected msgids', () => {
    const pot = readFileSync(POT_PATH, 'utf8');
    const ids = parseMsgids(pot);
    const expected = [
        'Caps Lock on',
        'Caps Lock off',
        'Charger connected',
        'Battery low — %d%%',
        'Behavior',
        'Disable %s',
        'Priority order for activity tiers',
        'Flash the pill when Caps Lock toggles',
    ];
    const missing = expected.filter(s => !ids.has(s));
    assert.deepEqual(missing, [],
        `these msgids are missing from the .pot — did you forget to run 'npm run i18n:update'? ${missing}`);
});

test('po/zh_CN.po exists', () => {
    assert.ok(existsSync(ZH_PATH), `${ZH_PATH} missing`);
});

test('po/zh_CN.po has no untranslated entries outside the header', () => {
    assertNoUntranslated(ZH_PATH);
});
