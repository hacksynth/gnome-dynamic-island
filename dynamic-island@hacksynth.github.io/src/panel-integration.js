import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _, ngettext } from 'resource:///org/gnome/shell/extensions/extension.js';
import { format } from './i18n.js';

export class PanelIntegration {
    constructor(view) {
        this._view = view;
        this._dateMenu = Main.panel.statusArea.dateMenu;
        this._dateMenuParent = null;
        this._mounted = false;
    }

    mount() {
        if (this._mounted) return;
        const center = Main.panel._centerBox;

        if (this._dateMenu) {
            this._dateMenuParent = this._dateMenu.container.get_parent();
            if (this._dateMenuParent) this._dateMenu.container.hide();
        }

        center.add_child(this._view);
        this._mounted = true;

        // Warn (don't fight) if other extensions added children.
        const siblings = center.get_children().filter(c => c !== this._view
            && (!this._dateMenu || c !== this._dateMenu.container));
        if (siblings.length > 0) {
            Main.notify(_('Dynamic Island'),
                format(
                    ngettext(
                        'Detected %d other center-box extension. Layout may be cramped.',
                        'Detected %d other center-box extensions. Layout may be cramped.',
                        siblings.length),
                    siblings.length));
        }
    }

    unmount() {
        if (!this._mounted) return;
        const center = Main.panel._centerBox;
        if (this._view.get_parent() === center) center.remove_child(this._view);

        if (this._dateMenu && this._dateMenuParent) this._dateMenu.container.show();
        this._mounted = false;
    }

    destroy() { this.unmount(); }
}
