import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import { createActivity, _now } from '../activity.js';

export class VolumeBrightnessProvider {
    constructor() {
        this.id = 'volume-brightness';
        this._manager = null;
        this._settings = null;
        this._origShow = null;
        this._volControl = null;
        this._volHandler = 0;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._volControl = Volume.getMixerControl();
        this._volHandler = this._volControl.connect('default-sink-volume-changed',
            (_c, sink) => this._flashVolume(sink));

        if (settings?.get_boolean('volume-replace-native-osd')) {
            const osd = Main.osdWindowManager;
            this._origShow = osd.show.bind(osd);
            osd.show = (...args) => {
                // Capture level and flash via our pill; suppress the native window.
                const level = args[2];
                if (Number.isFinite(level)) this._flashGeneric('Volume', Math.round(level * 100));
            };
        }
    }

    disable() {
        if (this._volControl && this._volHandler) this._volControl.disconnect(this._volHandler);
        this._volControl = null;
        this._volHandler = 0;
        if (this._origShow) { Main.osdWindowManager.show = this._origShow; this._origShow = null; }
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _flashVolume(sink) {
        if (!sink) return;
        const pct = Math.round((sink.volume / this._volControl.get_vol_max_norm()) * 100);
        this._flashGeneric(sink.is_muted ? 'Muted' : 'Volume', pct);
    }

    _flashGeneric(name, pct) {
        const duration = (this._settings?.get_int('transient-duration-ms') ?? 1500) * 1000;
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            label: `${name} ${pct}%`,
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
