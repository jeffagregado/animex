# AnimeX

AnimeX is a TanStack Start community app for tracking anime, publishing Reviews, and sharing Posts in a visibility-aware feed. Phase 5 includes Home, Following, and Global feed views, Review creation/detail/discovery, structured rich text, and one optional external Post media item.

## Development

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local`, fill the required values, and never commit local secrets. Run Convex locally when working on backend changes:

```bash
pnpm exec convex dev
```

## Validation and build

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm generate-routes
```

## Current architecture

- TanStack Start, TanStack Router, React, Tailwind CSS, and Base UI primitives.
- Convex owns application data, feed projections, Review discovery, and auth integration.
- Better Auth handles password and OAuth flows; Resend delivers auth email.
- Posts accept zero or one safe external HTTPS image/video URL. AnimeX does not upload, process, or server-fetch Post media.
- Review bodies use validated Lexical JSON. Review-level `containsSpoiler` is warning metadata; Summary stays visible while rich-text spoiler blocks reveal independently.

## Repository guides

- [Project plan](PLAN.md)
- [Product context](CONTEXT.md)
- [Task tracker](TODO.md)
- [Review/Post data flow](docs/architecture/review-discovery-data-flow.md)
- [Discover data flow](docs/architecture/discover-data-flow.md)
- [Phase 5 design QA](design-qa.md)
