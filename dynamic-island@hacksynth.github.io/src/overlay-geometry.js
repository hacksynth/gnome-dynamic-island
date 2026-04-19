// Pure geometry helpers for positioning the expansion overlay.
// No gi imports — runs under both node --test and gjs.

const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MIN_HEIGHT = 80;
const DEFAULT_SEAM_OVERLAP = 1;

// Compute the rectangle for the floating overlay, anchored below the pill
// and clamped to the pill's monitor work area.
//
// Inputs (all in stage / absolute coordinates — the same space that
// Clutter.Actor#get_transformed_position returns):
//   pill         { x, y, width, height }   — the pill's current rect
//   panelBottomY number                    — y of the bottom edge of the panel
//   monitor      { x, y, width, height }   — the target monitor's workArea
//   desired      { minWidth?, minHeight?, maxWidth?, seamOverlap? } (optional)
//
// Returns:
//   { x, y, width, height }                — overlay rect in the same space
//
// Width = clamp(max(pill.width, minWidth), 0, maxWidth ?? monitor.width).
// Height = minHeight (v1: fixed; v2 will measure content).
// Overlay is horizontally centered under the pill midpoint, then clamped
// so its left/right edges stay inside the monitor work area.
// Y is panelBottomY, optionally overlapping upward by seamOverlap px to
// swallow the hairline gap where hover events would otherwise fire leave.
export function computeOverlayRect({ pill, panelBottomY, monitor, desired } = {}) {
    assertRect(pill, 'pill');
    if (!Number.isFinite(panelBottomY))
        throw new Error('panelBottomY must be finite number');
    assertRect(monitor, 'monitor');

    const minWidth = desired?.minWidth ?? DEFAULT_MIN_WIDTH;
    const minHeight = desired?.minHeight ?? DEFAULT_MIN_HEIGHT;
    const maxWidth = desired?.maxWidth ?? monitor.width;
    const seamOverlap = desired?.seamOverlap ?? DEFAULT_SEAM_OVERLAP;

    const width = clamp(Math.max(pill.width, minWidth), 0, Math.min(maxWidth, monitor.width));
    const height = minHeight;

    const pillMidX = pill.x + pill.width / 2;
    const idealX = pillMidX - width / 2;
    const maxX = monitor.x + monitor.width - width;
    const x = clamp(idealX, monitor.x, maxX);

    const y = panelBottomY - seamOverlap;

    return { x, y, width, height };
}

function assertRect(r, name) {
    if (!r || typeof r !== 'object')
        throw new Error(`${name} must be an object with x/y/width/height`);
    for (const f of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(r[f]))
            throw new Error(`${name}.${f} must be finite number`);
    }
}

function clamp(v, min, max) {
    if (min > max) return min; // degenerate monitor; fail safe
    return Math.min(Math.max(v, min), max);
}

// Exported for tests.
export const _internals = { DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT, DEFAULT_SEAM_OVERLAP };
