// Pure helper for choosing what the island shows when no activity is active.

export function resolveIdleText(mode, customText, clockText) {
    switch (mode) {
    case 'blank':
        return '';
    case 'custom':
        return customText ?? '';
    case 'clock':
    default:
        return clockText ?? '';
    }
}
