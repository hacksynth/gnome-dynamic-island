import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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
