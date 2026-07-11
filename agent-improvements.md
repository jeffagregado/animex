# Agent Improvements

## Audit Target

AnimeX agent instructions and Phase 2 auth work.

## Evidence

- User reported visual drift from `docs/visual/auth/auth-desktop-sign-in.png`.
- User reported sign-in page lost the shared header.
- User reported the header logo did not match visual references.
- User reported the header auth action showed `Auth` before `Sign in`.
- User reported React maintainability drift from too many local components.
- User reported `Community` and `Stats` returned to the header despite MVP navigation specs excluding them.
- User requested lower token usage without reducing performance or quality after long multi-agent QA runs.

## Fixes Applied

- Inspect visual references before UI edits.
- Keep auth routes on the shared header shell unless explicitly scoped out.
- Use a project-owned AnimeX logo asset when no usable logo exists.
- Use blank reserved space for auth-loading state, not visible placeholder copy.
- Split home page sections into focused feature files.
- Keep shared shell navigation data aligned to `CONTEXT.md` Site Navigation: desktop header shows `Home` and `Discover`, not `Community` or `Stats`.

## Instruction Changes

- `AGENTS.md` now preserves configured role models, reasoning, and quality gates while reducing repeated discovery, oversized context forks, duplicate agent passes, and redundant validation.
- Delegation prompts now require bounded ownership, interfaces, expected output, and validation.
- Long-run pauses now require a durable checkpoint with its exact path and resume state.
