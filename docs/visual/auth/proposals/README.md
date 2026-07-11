# AnimeX Auth Proposal Refs

Source of truth for missing auth page visuals. Existing locked refs stay:

- `docs/visual/auth/auth-desktop-sign-in.png`
- `docs/visual/auth/auth-mobile-create-account.png`

These proposal refs cover the auth pages:

- `auth-proposal-verify-email-desktop.png`
- `auth-proposal-verify-email-mobile.png`
- `auth-proposal-choose-username-desktop.png`
- `auth-proposal-choose-username-mobile.png`
- `auth-proposal-forgot-password-desktop.png`
- `auth-proposal-forgot-password-mobile.png`
- `auth-proposal-set-new-password-desktop.png`
- `auth-proposal-set-new-password-mobile.png`
- `auth-proposal-reset-success-desktop.png`
- `auth-proposal-reset-success-mobile.png`
- `auth-proposal-reset-invalid-desktop.png`
- `auth-proposal-reset-invalid-mobile.png`

Generated image sizes differ from requested artboard sizes. Desktop refs are `1586x992`; mobile refs are about `853x1844`. Implement against responsive layouts, not raw bitmap dimensions.

## Design Rules

- Header nav uses `Home` and `Discover` only.
- Mobile auth uses brand header only, no desktop nav.
- Shell uses deep navy, subtle poster silhouettes, large faint diagonal `X` linework, and restrained cyan/coral accents.
- Auth panel stays flat and translucent, with modest radius and thin border.
- Desktop panel width targets about `560px` for short states and `640px` for forms.
- Mobile panel uses generous side margins and must fit without horizontal overflow.
- Inputs are dark, full width, about `56px` to `64px` high, with low-contrast borders.
- Cyan primary action: verify email, username completion, set new password.
- Coral primary action: reset-link request.
- Coral secondary action: sign in/sign out links and invalid-token action.
- Reset invalid token is a hard stop: no password fields.
- Reset success shows no account identity.
- Ignore generated OS chrome artifacts, including the white home indicator visible in the mobile invalid-token ref.
