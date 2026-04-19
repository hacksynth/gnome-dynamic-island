import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;
const TRANSLATION_Y_START = -8;
const ATK_ROLE_PANEL = 42;

// Floating expansion overlay. Parented to Main.layoutManager.uiGroup by
// ExpansionController, never added directly to the panel.
export const IslandOverlay = GObject.registerClass(
class IslandOverlay extends St.Widget {
    _init() {
        super._init({
            // Clutter.BoxLayout only accepts orientation/spacing; child alignment
            // is expressed on the child actors (x_expand / x_align) instead.
            style_class: 'dynisland-overlay',
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
            }),
            reactive: true,
            track_hover: true,
            opacity: 0,
            visible: false,
            x_expand: false,
            y_expand: false,
        });
        this.accessible_role = ATK_ROLE_PANEL;

        this._label = new St.Label({
            style_class: 'dynisland-overlay-label',
            x_expand: true,
        });
        this.add_child(this._label);

        this._sublabel = new St.Label({
            style_class: 'dynisland-overlay-sublabel',
            x_expand: true,
            visible: false,
        });
        this.add_child(this._sublabel);

        this._targetHeight = 0;
    }

    setContentForVM(vm) {
        const primary = vm?.leading ?? vm?.trailing ?? null;
        if (!primary) {
            this._label.text = '';
            this._sublabel.hide();
            this.accessible_name = '';
            return;
        }
        this._label.text = primary.label;
        this.accessible_name = primary.label;
        if (primary.sublabel) {
            this._sublabel.text = primary.sublabel;
            this._sublabel.show();
            this.accessible_description = primary.sublabel;
        } else {
            this._sublabel.hide();
            this.accessible_description = '';
        }
    }

    // Open animation: position immediately, fade in, slide down from -8px,
    // using an overshoot easing for the characteristic drop-in feel.
    openAt(rect) {
        this.remove_all_transitions();
        this.set_position(Math.round(rect.x), Math.round(rect.y));
        this.set_size(Math.round(rect.width), Math.round(rect.height));
        this._targetHeight = rect.height;
        this.translation_y = TRANSLATION_Y_START;
        this.opacity = 0;
        this.show();
        this.ease({
            opacity: 255,
            translation_y: 0,
            duration: OPEN_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        });
    }

    // Close animation: slide up + fade out, then invoke onDone. Caller
    // owns teardown (unparenting + destroy).
    closeAndDetach(onDone) {
        this.remove_all_transitions();
        this.ease({
            opacity: 0,
            translation_y: TRANSLATION_Y_START,
            duration: CLOSE_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this.hide();
                if (typeof onDone === 'function') onDone();
            },
        });
    }

    // Reposition without re-animating — used when the pill shifts while
    // the overlay is already open (e.g. hot-plugging a monitor).
    reposition(rect) {
        this.set_position(Math.round(rect.x), Math.round(rect.y));
        this.set_size(Math.round(rect.width), Math.round(rect.height));
        this._targetHeight = rect.height;
    }

    destroy() {
        this.remove_all_transitions();
        super.destroy();
    }
});
