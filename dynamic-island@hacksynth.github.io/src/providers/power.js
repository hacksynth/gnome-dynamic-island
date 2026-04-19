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
