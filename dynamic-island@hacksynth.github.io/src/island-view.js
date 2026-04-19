import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

export const IslandView = GObject.registerClass(
class IslandView extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'dynisland-pill state-idle',
            reactive: true,
            track_hover: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.accessible_role = 2; // ATK_ROLE_PUSH_BUTTON
        this.can_focus = false;

        // Underlying content (compact/split/expanded) stays mounted.
        this._baseLabel = new St.Label({
            style_class: 'dynisland-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._baseLabel);

        // Overlay child for transient flashes — fades over the base content.
        this._flashLabel = new St.Label({
            style_class: 'dynisland-label',
            y_align: Clutter.ActorAlign.CENTER,
            opacity: 0,
            visible: false,
        });
        this.add_child(this._flashLabel);

        this._currentFlashId = null;
    }

    setViewModel(vm) {
        const states = ['idle', 'compact', 'split', 'expanded'];
        for (const s of states) this.remove_style_class_name(`state-${s}`);
        this.add_style_class_name(`state-${vm.baseState}`);

        // Base content always reflects the underlying slots (never cleared by a flash).
        const basePrimary = vm.leading ?? vm.trailing;
        this._baseLabel.text = basePrimary ? this._formatBase(vm, basePrimary) : '';
        this.accessible_name = basePrimary ? basePrimary.label : 'Dynamic Island (idle)';

        // Transient overlay lifecycle.
        if (vm.flashing) {
            if (vm.flashing.id !== this._currentFlashId) {
                this._currentFlashId = vm.flashing.id;
                this._flashLabel.text = vm.flashing.sublabel
                    ? `${vm.flashing.label} — ${vm.flashing.sublabel}`
                    : vm.flashing.label;
                this._flashLabel.show();
                this._flashLabel.ease({
                    opacity: 255,
                    duration: 120,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
                this.add_style_class_name('flashing');
                this.accessible_description = `Flash: ${vm.flashing.label}`;
            }
        } else if (this._currentFlashId) {
            this._currentFlashId = null;
            this._flashLabel.ease({
                opacity: 0,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._flashLabel.hide(),
            });
            this.remove_style_class_name('flashing');
            this.accessible_description = '';
        }
    }

    _formatBase(vm, primary) {
        if (vm.baseState === 'split' && vm.leading && vm.trailing)
            return `${vm.leading.label} · ${vm.trailing.label}`;
        if (vm.baseState === 'expanded' && primary.sublabel)
            return `${primary.label} — ${primary.sublabel}`;
        return primary.label;
    }
});
