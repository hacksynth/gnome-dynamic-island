import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ActivityManager } from './src/activity-manager.js';
import { IslandView } from './src/island-view.js';
import { PanelIntegration } from './src/panel-integration.js';
import { InteractionController } from './src/interaction-controller.js';
import { ExpansionController } from './src/expansion-controller.js';
import { KeyboardProvider } from './src/providers/keyboard.js';
import { PowerProvider } from './src/providers/power.js';
import { VolumeBrightnessProvider } from './src/providers/volume-brightness.js';
import { MediaProvider } from './src/providers/media.js';
import { NotificationProvider } from './src/providers/notification.js';

export default class DynamicIslandExtension extends Extension {
    enable() {
        const settings = this.getSettings();
        this._settings = settings;

        this._manager = new ActivityManager();
        this._view = new IslandView();
        this._view.setSettings(settings);
        this._unsub = this._manager.subscribe(vm => this._view.setViewModel(vm));
        this._panel = new PanelIntegration(this._view);
        this._panel.mount();
        this._interaction = new InteractionController(this._view, this._manager, this);
        this._expansion = new ExpansionController(this._view, this._manager);

        // 250ms ticker to expire transients.
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._manager.tick();
            return GLib.SOURCE_CONTINUE;
        });

        const all = {
            'keyboard': KeyboardProvider,
            'power': PowerProvider,
            'volume-brightness': VolumeBrightnessProvider,
            'media': MediaProvider,
            'notification': NotificationProvider,
        };
        const enabled = new Set(settings.get_strv('providers-enabled'));
        this._providers = [];
        for (const [id, Cls] of Object.entries(all)) {
            if (enabled.has(id)) {
                const p = new Cls();
                p.enable(this._manager, settings);
                this._providers.push(p);
            }
        }

        this._settingsHandler = settings.connect('changed::providers-enabled', () => {
            // Rebuild the provider set without a full extension restart.
            for (const p of this._providers) p.disable();
            const now = new Set(settings.get_strv('providers-enabled'));
            this._providers = [];
            for (const [id, Cls] of Object.entries(all)) {
                if (now.has(id)) {
                    const p = new Cls();
                    p.enable(this._manager, settings);
                    this._providers.push(p);
                }
            }
        });
    }

    disable() {
        if (this._tickId) { GLib.source_remove(this._tickId); this._tickId = 0; }
        if (this._settingsHandler) {
            this._settings?.disconnect(this._settingsHandler);
            this._settingsHandler = 0;
        }
        this._settings = null;
        for (const p of (this._providers ?? [])) p.disable();
        this._providers = [];

        this._expansion?.destroy(); this._expansion = null;
        this._interaction?.destroy(); this._interaction = null;
        this._panel?.destroy(); this._panel = null;
        this._unsub?.(); this._unsub = null;
        this._view?.destroy(); this._view = null;
        this._manager?.destroy(); this._manager = null;
    }
}
