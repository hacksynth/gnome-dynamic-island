// Maps providerId (stable gschema string) to a user-visible label.
// N_() is an identity marker xgettext picks up via --keyword=N_ so the
// strings enter the .pot catalog; the caller's gettext does the actual
// lookup at call time (so prefs-process vs shell-process binding is right).

const N_ = s => s;

const NAMES = {
    'media':             N_('Media'),
    'notification':      N_('Notifications'),
    'volume-brightness': N_('Volume / Brightness'),
    'power':             N_('Power'),
    'keyboard':          N_('Keyboard'),
};

export function providerDisplayName(id, gettext) {
    return gettext(NAMES[id] ?? id);
}
