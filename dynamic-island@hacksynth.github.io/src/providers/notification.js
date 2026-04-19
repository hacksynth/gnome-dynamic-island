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
