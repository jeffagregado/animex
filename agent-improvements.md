# Agent Improvements

## Audit Target

AnimeX Phase 2 auth and shell UI work.

## Evidence

- User reported visual drift from `docs/visual/auth/auth-desktop-sign-in.png`.
- User reported sign-in page lost the shared header.
- User reported the header logo did not match visual references.
- User reported the header auth action showed `Auth` before `Sign in`.
- User reported React maintainability drift from too many local components.
- User reported `Community` and `Stats` returned to the header despite MVP navigation specs excluding them.

## Fixes Applied

- Inspect visual references before UI edits.
- Keep auth routes on the shared header shell unless explicitly scoped out.
- Use a project-owned AnimeX logo asset when no usable logo exists.
- Use blank reserved space for auth-loading state, not visible placeholder copy.
- Split home page sections into focused feature files.
- Keep shared shell navigation data aligned to `CONTEXT.md` Site Navigation: desktop header shows `Home` and `Discover`, not `Community` or `Stats`.

## Instruction Changes

None. No `AGENTS.md` or skill source files were edited.
