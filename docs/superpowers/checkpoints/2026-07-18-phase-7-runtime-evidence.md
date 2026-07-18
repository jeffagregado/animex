# Phase 7 Runtime Evidence

Status: BASELINE CAPTURED on 2026-07-18, 09:50-09:54 Asia/Manila.

## Confirmed Signatures

### Direct Profile auth loader

- Entry: direct `GET /users/codexqa1784015885`
- State: signed-in complete account
- First DOM: `Checking authentication…`
- Result: Profile renders after client auth settles.
- Required fix: server-auth-first route hydration; no auth-check DOM.

### Quick Search User avatar

- Flow: Profile Reviews → header Search → query `codexqa`
- User result accessible text: `Image unavailable codexqa1784015885 @codexqa1784015885`
- Result: generic missing-image renderer used; shared `UserAvatar` absent.
- Required fix: User group uses circular `UserAvatar`.

### User Search avatar and auth loader

- Entry: direct `GET /search/users?q=codexqa`
- First DOM: `Checking authentication…`
- Settled result: user link has name and username only; no user image.
- Required fix: server-auth-first route plus shared 64px `UserAvatar`.

### Mobile Profile overflow

- Entry: direct Profile at requested 390 x 844 viewport.
- Settled DOM client width: `375px`.
- Document and body scroll width: `503px`.
- Result: `128px` horizontal overflow.
- Required fix: contain avatar, identity, content, support rail, cards, and text children.

### Root not-found warning

- Entry: direct `GET /phase-7-feedback-missing-route`
- DOM: generic `<p>Not Found</p>`.
- Server signature: root route has no `notFoundComponent` or router default.
- Vite behavior: forwarded warning recursively amplifies through client/server console bridge.
- Required fix: root-owned AnimeX not-found component.

### Catalog Person divergence

- Character fixture: `/characters/12/alphonse-elric`; tabs are Overview and Anime.
- Staff fixture: `/staff/112215/atsumi-tanezaki`; tabs are Overview and Works.
- Result: Staff label and canonical tab differ from locked Overview/Anime contract.
- Required fix: shared Anime Detail geometry; Staff `works` canonicalizes to `anime`.

## Not Reproduced In Current Run

- React invalid-hook call
- `QueryClientProvider` render failure
- `profiles:getByUsername` `Unauthenticated`
- hydration exception

Evidence limits:

- `pnpm why react --depth 8` reports one React version.
- Current signed-in Profile, User Search, Character, and Staff flows produced no new browser error entries before root warning amplification.
- Do not change dependency resolution, Query provider wiring, or hook placement without new stack evidence.

## Baseline UI

- Complete-account header: standalone `Sign out` button.
- Profile tab click settles on requested panel but direct entry exposes auth-loader page first.
- Character shell already uses Overview and Anime.
- Staff shell uses Overview and Works.

## Closure Check

Restart dev server and use fresh browser tab after fixes. Re-run exact entries. Browser and server logs must contain none of confirmed signatures or supplied error signatures.
