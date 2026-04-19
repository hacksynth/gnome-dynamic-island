import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { format } from './i18n.js';
import { providerDisplayName } from './provider-display.js';

export class InteractionController {
    constructor(view, manager, extension) {
        this._view = view;
        this._manager = manager;
        this._extension = extension;
        this._handlers = [];
        this._contextMenu = null;

        // Hover events are owned by ExpansionController so pill and overlay
        // can be treated as one hover target. Only discrete actions live here.
        this._handlers.push(
            view.connect('button-press-event', (_a, ev) => {
                const btn = ev.get_button();
                if (btn === Clutter.BUTTON_PRIMARY) {
                    manager.setPinned(!manager.isPinned());
                    return Clutter.EVENT_STOP;
                }
                if (btn === Clutter.BUTTON_SECONDARY) {
                    this._showContextMenu();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }),
            view.connect('key-press-event', (_a, ev) => {
                if (ev.get_key_symbol() === Clutter.KEY_Escape) {
                    manager.setPinned(false);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }),
        );
    }

    _showContextMenu() {
        if (this._contextMenu) { this._contextMenu.destroy(); this._contextMenu = null; }

        const menu = new PopupMenu.PopupMenu(this._view, 0.5, St.Side.TOP);
        Main.uiGroup.add_child(menu.actor);
        menu.actor.hide();

        const prefsItem = new PopupMenu.PopupMenuItem(_('Preferences…'));
        prefsItem.connect('activate', () => this._extension.openPreferences());
        menu.addMenuItem(prefsItem);

        const vm = this._manager._lastVM;
        const current = vm.flashing ?? vm.leading ?? vm.trailing;
        if (current) {
            const disableItem = new PopupMenu.PopupMenuItem(
                format(_('Disable %s'), providerDisplayName(current.providerId, _)));
            disableItem.connect('activate', () => {
                const settings = this._extension.getSettings();
                const enabled = new Set(settings.get_strv('providers-enabled'));
                enabled.delete(current.providerId);
                settings.set_strv('providers-enabled', [...enabled]);
            });
            menu.addMenuItem(disableItem);
        }

        menu.open();
        menu.connect('menu-closed', () => { menu.destroy(); this._contextMenu = null; });
        this._contextMenu = menu;
    }

    destroy() {
        if (this._contextMenu) { this._contextMenu.destroy(); this._contextMenu = null; }
        for (const id of this._handlers) this._view.disconnect(id);
        this._handlers = [];
    }
}
