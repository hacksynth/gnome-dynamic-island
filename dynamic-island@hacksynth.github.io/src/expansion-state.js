// Pure state-derivation for the expansion overlay.
// No gi imports — runs under both node --test and gjs.

// Derive what the expansion overlay should do given the raw input signals.
//
// Inputs:
//   pillHover    boolean  — pointer is currently over the panel pill
//   overlayHover boolean  — pointer is currently over the floating overlay
//   pinned       boolean  — user has click-pinned the island open
//   animating    boolean  — a close animation is still running
//
// Output:
//   target       'open' | 'closed'  — the steady-state goal
//   shouldMount  boolean            — whether the overlay actor should
//                                     currently exist in the scene graph
//                                     (true when open, or while animating
//                                     closed so the close anim can finish
//                                     before we destroy the actor)
export function deriveExpansion({ pillHover, overlayHover, pinned, animating } = {}) {
    const wantOpen = Boolean(pinned || pillHover || overlayHover);
    return {
        target: wantOpen ? 'open' : 'closed',
        shouldMount: wantOpen || Boolean(animating),
    };
}

// Convenience: OR of both hover signals. The ActivityManager only understands
// a single "hover" boolean today; the controller uses this to feed it the
// merged value so either surface keeps the island expanded.
export function mergedHover({ pillHover, overlayHover } = {}) {
    return Boolean(pillHover || overlayHover);
}
