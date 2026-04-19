import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ActivityManager } from './src/activity-manager.js';
import { IslandView } from './src/island-view.js';
import { PanelIntegration } from './src/panel-integration.js';
import { InteractionController } from './src/interaction-controller.js';
import { KeyboardProvider } from './src/providers/keyboard.js';

export default class DynamicIslandExtension extends Extension {
    enable() {
        this._manager = new ActivityManager();
        this._view = new IslandView();
        this._unsub = this._manager.subscribe(vm => this._view.setViewModel(vm));
        this._panel = new PanelIntegration(this._view);
        this._panel.mount();
        this._interaction = new InteractionController(this._view, this._manager, this);

        // 250ms ticker to expire transients.
        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._manager.tick();
            return GLib.SOURCE_CONTINUE;
        });

        this._providers = [new KeyboardProvider()];
        for (const p of this._providers) p.enable(this._manager, this.getSettings());
    }

    disable() {
        if (this._tickId) { GLib.source_remove(this._tickId); this._tickId = 0; }
        for (const p of (this._providers ?? [])) p.disable();
        this._providers = [];

        this._interaction?.destroy(); this._interaction = null;
        this._panel?.destroy(); this._panel = null;
        this._unsub?.(); this._unsub = null;
        this._view?.destroy(); this._view = null;
        this._manager?.destroy(); this._manager = null;
    }
}
