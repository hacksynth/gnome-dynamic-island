import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import { createActivity, _now } from '../activity.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { format } from '../i18n.js';

// GvcMixerControl has no 'default-sink-volume-changed' signal. Subscribe to the
// default sink's notify::volume / notify::is-muted and rebind when the default
// sink itself changes.

export class VolumeBrightnessProvider {
    constructor() {
        this.id = 'volume-brightness';
        this._manager = null;
        this._settings = null;
        this._origShow = null;
        this._volControl = null;
        this._controlHandler = 0;
        this._sink = null;
        this._sinkHandlers = [];
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;

        this._volControl = Volume.getMixerControl();
        this._controlHandler = this._volControl.connect('default-sink-changed', (_c, id) => {
            this._rebindSink(this._volControl.lookup_stream_id(id));
        });
        this._rebindSink(this._volControl.get_default_sink());

        if (settings?.get_boolean('volume-replace-native-osd')) {
            const osd = Main.osdWindowManager;
            this._origShow = osd.show.bind(osd);
            osd.show = (...args) => {
                const level = args[2];
                if (Number.isFinite(level)) this._flashGeneric(_('Volume'), Math.round(level * 100));
            };
        }
    }

    disable() {
        this._unbindSink();
        if (this._volControl && this._controlHandler) {
            try { this._volControl.disconnect(this._controlHandler); } catch (_) {}
        }
        this._volControl = null;
        this._controlHandler = 0;
        if (this._origShow) { Main.osdWindowManager.show = this._origShow; this._origShow = null; }
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    _unbindSink() {
        if (this._sink) {
            for (const h of this._sinkHandlers) {
                try { this._sink.disconnect(h); } catch (_) {}
            }
        }
        this._sinkHandlers = [];
        this._sink = null;
    }

    _rebindSink(sink) {
        this._unbindSink();
        if (!sink) return;
        this._sink = sink;
        this._sinkHandlers.push(
            sink.connect('notify::volume', () => this._flashVolume(sink)),
            sink.connect('notify::is-muted', () => this._flashVolume(sink)),
        );
    }

    _flashVolume(sink) {
        if (!sink || !this._volControl) return;
        const pct = Math.round((sink.volume / this._volControl.get_vol_max_norm()) * 100);
        this._flashGeneric(sink.is_muted ? _('Muted') : _('Volume'), pct);
    }

    _flashGeneric(name, pct) {
        if (!this._manager) return;
        const duration = (this._settings?.get_int('transient-duration-ms') ?? 1500) * 1000;
        const now = _now();
        this._manager.push(createActivity({
            id: `${this.id}:flash`,
            providerId: this.id,
            tier: 'transient',
            slot: 'either',
            label: format('%s %d%%', name, pct),
            startedAt: now,
            expiresAt: now + duration,
        }));
    }
}
