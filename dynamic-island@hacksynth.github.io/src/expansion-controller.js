import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { IslandOverlay } from './island-overlay.js';
import { computeOverlayRect } from './overlay-geometry.js';
import { deriveExpansion, mergedHover } from './expansion-state.js';

// Milliseconds the controller waits after both hovers turn false before
// actually collapsing. Tunes out micro-flap as the pointer crosses the
// pill/overlay seam and gives the user a brief grace period to return.
const HOVER_GRACE_MS = 80;

// Minimum pill width below which we refuse to compute an overlay rect —
// during the extension's first layout pass the pill may still report a
// 0-sized allocation.
const MIN_PILL_WIDTH_FOR_RECT = 8;

// ExpansionController coordinates the floating overlay. Owns:
//   - overlay lifecycle (mount to Main.layoutManager.uiGroup, unmount)
//   - merged hover tracking (pill OR overlay) with hover-intent debounce
//   - click-outside dismissal via global.stage captured-event
//   - monitor / session-mode reactivity
//
// IslandView stays presentational; PanelIntegration stays focused on
// centerBox mounting; this class is the glue between state and layout.
export class ExpansionController {
    constructor(view, manager) {
        this._view = view;
        this._manager = manager;
        this._overlay = null;
        this._pillHover = false;
        this._overlayHover = false;
        this._graceTimerId = 0;
        this._capturedEventId = 0;
        this._monitorsChangedId = 0;
        this._sessionModeId = 0;
        this._pillSignalIds = [];
        this._overlaySignalIds = [];
        this._lastVM = null;
        this._isOpen = false;

        // Hook pill enter/leave. Button-press and key-press stay owned by
        // InteractionController; this controller only cares about hover.
        this._pillSignalIds.push(
            this._view.connect('enter-event', () => {
                this._setPillHover(true);
                return Clutter.EVENT_PROPAGATE;
            }),
            this._view.connect('leave-event', () => {
                this._setPillHover(false);
                return Clutter.EVENT_PROPAGATE;
            }),
        );

        // Subscribe to VM after hover wiring so first VM delivery can
        // immediately react.
        this._unsub = this._manager.subscribe(vm => this._onVM(vm));

        // Rebuild overlay geometry when monitors change (hot-plug, wake).
        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._repositionIfOpen());

        // Force-close on session-mode transitions (lock screen etc.).
        this._sessionModeId = Main.sessionMode.connect(
            'updated', () => this._onSessionModeUpdated());
    }

    // ----- hover & state -----

    _setPillHover(v) {
        v = Boolean(v);
        if (this._pillHover === v) return;
        this._pillHover = v;
        this._applyHover();
    }

    _setOverlayHover(v) {
        v = Boolean(v);
        if (this._overlayHover === v) return;
        this._overlayHover = v;
        this._applyHover();
    }

    _applyHover() {
        this._cancelGrace();
        const merged = mergedHover({
            pillHover: this._pillHover,
            overlayHover: this._overlayHover,
        });
        if (merged) {
            // Instant open on any hover entering.
            this._manager.setHover(true);
        } else {
            // Debounce: start an 80ms timer; if still not hovered, close.
            this._graceTimerId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, HOVER_GRACE_MS, () => {
                    this._graceTimerId = 0;
                    if (!this._pillHover && !this._overlayHover)
                        this._manager.setHover(false);
                    return GLib.SOURCE_REMOVE;
                });
        }
    }

    _cancelGrace() {
        if (this._graceTimerId) {
            GLib.source_remove(this._graceTimerId);
            this._graceTimerId = 0;
        }
    }

    // ----- VM → overlay mount/unmount -----

    _onVM(vm) {
        this._lastVM = vm;
        const decision = deriveExpansion({
            pillHover: this._pillHover,
            overlayHover: this._overlayHover,
            pinned: vm.pinned,
            animating: this._isOpen && !this._isWanted(vm),
        });
        if (decision.target === 'open') this._ensureOpen(vm);
        else this._ensureClosed();

        if (this._overlay) this._overlay.setContentForVM(vm);
    }

    _isWanted(vm) {
        return vm.hovered || vm.pinned;
    }

    _ensureOpen(vm) {
        const rect = this._computeRect();
        if (!rect) {
            // Pill not yet allocated; try again on next VM tick.
            return;
        }
        if (!this._overlay) {
            this._overlay = new IslandOverlay();
            this._overlay.setContentForVM(vm);
            Main.layoutManager.uiGroup.add_child(this._overlay);
            this._attachOverlayHandlers();
            this._view.setAttachedBelow(true);
            this._overlay.openAt(rect);
            this._connectCapturedEvent();
        } else {
            // Already open — just reposition.
            this._overlay.reposition(rect);
        }
        this._isOpen = true;
    }

    _ensureClosed() {
        if (!this._overlay) return;
        const overlay = this._overlay;
        this._overlay = null;
        this._isOpen = false;
        this._detachOverlayHandlers(overlay);
        this._disconnectCapturedEvent();
        overlay.closeAndDetach(() => {
            if (overlay.get_parent())
                overlay.get_parent().remove_child(overlay);
            overlay.destroy();
            // Defer the pill corner reset until the close anim finishes so
            // the visual seam stays intact during the slide-up.
            this._view.setAttachedBelow(false);
        });
    }

    _computeRect() {
        const pill = this._view.getPillRect();
        if (!pill || pill.width < MIN_PILL_WIDTH_FOR_RECT) return null;
        const monitor = Main.layoutManager.findMonitorForActor(this._view)
            ?? Main.layoutManager.primaryMonitor;
        if (!monitor) return null;
        const workArea = Main.layoutManager.getWorkAreaForMonitor?.(monitor.index)
            ?? { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height };
        const panelBottomY = pill.y + pill.height;
        return computeOverlayRect({
            pill,
            panelBottomY,
            monitor: workArea,
        });
    }

    _repositionIfOpen() {
        if (!this._overlay) return;
        const rect = this._computeRect();
        if (rect) this._overlay.reposition(rect);
    }

    // ----- overlay hover wiring -----

    _attachOverlayHandlers(overlay = this._overlay) {
        this._overlaySignalIds = [
            overlay.connect('enter-event', () => {
                this._setOverlayHover(true);
                return Clutter.EVENT_PROPAGATE;
            }),
            overlay.connect('leave-event', () => {
                this._setOverlayHover(false);
                return Clutter.EVENT_PROPAGATE;
            }),
            overlay.connect('key-press-event', (_a, ev) => {
                if (ev.get_key_symbol() === Clutter.KEY_Escape) {
                    this._manager.setPinned(false);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }),
        ];
    }

    _detachOverlayHandlers(overlay) {
        for (const id of this._overlaySignalIds) {
            try { overlay.disconnect(id); } catch (_e) { /* already gone */ }
        }
        this._overlaySignalIds = [];
        this._overlayHover = false;
    }

    // ----- click-outside -----

    _connectCapturedEvent() {
        if (this._capturedEventId) return;
        this._capturedEventId = global.stage.connect(
            'captured-event', (_stage, ev) => this._onCapturedEvent(ev));
    }

    _disconnectCapturedEvent() {
        if (!this._capturedEventId) return;
        global.stage.disconnect(this._capturedEventId);
        this._capturedEventId = 0;
    }

    _onCapturedEvent(ev) {
        if (ev.type() !== Clutter.EventType.BUTTON_PRESS)
            return Clutter.EVENT_PROPAGATE;
        const source = ev.get_source();
        if (!source) return Clutter.EVENT_PROPAGATE;
        if (this._isDescendantOf(source, this._view))
            return Clutter.EVENT_PROPAGATE;
        if (this._overlay && this._isDescendantOf(source, this._overlay))
            return Clutter.EVENT_PROPAGATE;
        // Click landed outside both surfaces — treat as dismiss.
        this._manager.setPinned(false);
        this._pillHover = false;
        this._overlayHover = false;
        this._manager.setHover(false);
        return Clutter.EVENT_PROPAGATE;
    }

    _isDescendantOf(actor, ancestor) {
        let cursor = actor;
        while (cursor) {
            if (cursor === ancestor) return true;
            cursor = cursor.get_parent?.();
        }
        return false;
    }

    // ----- session mode -----

    _onSessionModeUpdated() {
        // On transitions to restricted modes (unlock-dialog, lock-screen),
        // force the island closed. extension.disable() is the normal path
        // but defence-in-depth prevents a stale overlay lingering.
        const mode = Main.sessionMode.currentMode;
        if (mode !== 'user') {
            this._manager.setPinned(false);
            this._pillHover = false;
            this._overlayHover = false;
            this._manager.setHover(false);
        }
    }

    // ----- teardown -----

    destroy() {
        this._cancelGrace();
        this._disconnectCapturedEvent();
        if (this._unsub) { this._unsub(); this._unsub = null; }
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
        if (this._sessionModeId) {
            Main.sessionMode.disconnect(this._sessionModeId);
            this._sessionModeId = 0;
        }
        for (const id of this._pillSignalIds) {
            try { this._view.disconnect(id); } catch (_e) { /* view gone */ }
        }
        this._pillSignalIds = [];
        if (this._overlay) {
            this._detachOverlayHandlers(this._overlay);
            if (this._overlay.get_parent())
                this._overlay.get_parent().remove_child(this._overlay);
            this._overlay.destroy();
            this._overlay = null;
        }
        this._view.setAttachedBelow(false);
        this._view = null;
        this._manager = null;
    }
}
