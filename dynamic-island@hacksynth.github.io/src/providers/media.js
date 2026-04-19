import Gio from 'gi://Gio';
import { createActivity, _now } from '../activity.js';

const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

export class MediaProvider {
    constructor() {
        this.id = 'media';
        this._manager = null;
        this._settings = null;
        this._dbus = null;
        this._busHandler = 0;
        this._players = new Map();   // busName → { proxy, propsHandler }
    }

    async enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._dbus = Gio.DBus.session;

        const watcher = this._dbus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (_c, _s, _p, _i, _sig, params) => {
                const [name, oldOwner, newOwner] = params.deepUnpack();
                if (!name.startsWith(MPRIS_BUS_PREFIX)) return;
                if (newOwner && !oldOwner) this._addPlayer(name);
                else if (oldOwner && !newOwner) this._removePlayer(name);
            });
        this._busHandler = watcher;

        const [names] = await this._dbus.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'ListNames', null, null, Gio.DBusCallFlags.NONE, -1, null).then(r => r.deepUnpack());

        for (const n of names) if (n.startsWith(MPRIS_BUS_PREFIX)) this._addPlayer(n);
    }

    disable() {
        if (this._busHandler) this._dbus.signal_unsubscribe(this._busHandler);
        this._busHandler = 0;
        for (const [name, entry] of this._players) {
            entry.proxy.disconnect(entry.propsHandler);
            this._manager?.remove(`${this.id}:${name}`);
        }
        this._players.clear();
        this._manager = null;
    }

    async _addPlayer(busName) {
        const proxy = new Gio.DBusProxy({
            g_connection: this._dbus,
            g_name: busName,
            g_object_path: MPRIS_PATH,
            g_interface_name: PLAYER_IFACE,
            g_flags: Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES,
        });
        try { await proxy.init_async(0, null); } catch (_) { return; }

        const propsHandler = proxy.connect('g-properties-changed', () => this._refresh(busName, proxy));
        this._players.set(busName, { proxy, propsHandler });
        this._refresh(busName, proxy);
    }

    _removePlayer(busName) {
        const entry = this._players.get(busName);
        if (entry) entry.proxy.disconnect(entry.propsHandler);
        this._players.delete(busName);
        this._manager?.remove(`${this.id}:${busName}`);
    }

    _refresh(busName, proxy) {
        const status = proxy.get_cached_property('PlaybackStatus')?.deepUnpack();
        const metadata = proxy.get_cached_property('Metadata')?.deepUnpack() ?? {};
        const title = metadata['xesam:title']?.deepUnpack?.() ?? metadata['xesam:title'] ?? '';
        const artistArr = metadata['xesam:artist']?.deepUnpack?.() ?? metadata['xesam:artist'] ?? [];
        const artist = Array.isArray(artistArr) ? artistArr.join(', ') : String(artistArr);

        if (status !== 'Playing' || !title) {
            this._manager.remove(`${this.id}:${busName}`);
            return;
        }

        this._manager.update(createActivity({
            id: `${this.id}:${busName}`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'leading',
            priority: Date.now(),   // most recently active wins
            label: title,
            sublabel: artist,
        }));
    }
}
