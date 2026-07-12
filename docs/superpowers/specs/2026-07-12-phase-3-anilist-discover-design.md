# Phase 3 AniList And Discover Design

## Goal

Ship public responsive Discover page. Hide AniList GraphQL endpoint behind portable TanStack Start server functions. Use Convex only for validated cache storage, queries, and mutations.

## Architecture

```text
Browser
  -> TanStack Start server function
  -> AniList GraphQL

TanStack Start server function
  <-> Convex cache queries/mutations
```

- No Convex actions.
- No direct client-to-AniList GraphQL request.
- No new production dependency.
- Standard Web APIs preserve Vercel/VPS portability.
- Shared public shell lives in `src/routes/_public/route.tsx`.

## Data

- Canonical identity: numeric AniList `id` stored as `anilistId`.
- Display title priority: English, Romaji, Native. Missing all titles fails normalization.
- Slug keeps Unicode letters/numbers, lowercases, and collapses separators.
- Summary fields: titles, cover/banner, format, season/year, episodes, genres, popularity, score, trending, start date, next airing.
- Sections: Trending 12/3h; Seasonal 12/24h; Recommendations 16/24h; Upcoming 10/6h.
- This Week derives top five Trending entries.
- Genres stay typed local data. Desktop Top Genres shows no fake counts.
- Expired/missing refresh failure shows explicit section error. No stale, fake, or silent substitution.

## Search

- Anime only; adult results excluded server-side.
- Query length: 2-100 when present.
- Filters: genre, format, season, year, sort.
- Sorts: relevance, trending, popularity, score, newest.
- Twenty results/page. Use `hasNextPage`; never use inaccurate total-page data.
- Search uses TanStack Query infinite pagination and never writes to Convex.

## UI

- Replace canonical Discover desktop/mobile references with approved generated images.
- Desktop: main rails plus This Week, Top Genres, Upcoming, Manga placeholder support column.
- Mobile: horizontal rails, two-column Genres/This Week, Upcoming, Manga placeholder; omit separate Top Genres.
- Anime cards remain display-only until Phase 4 detail route.
- Every visible control works. Loading, empty, image error, section error, retry, rate limit, next-page, and end states required.
- Browser targets: 390, 768, 1280 pixels. Keyboard, focus, reduced motion, safe areas, hydration, console, and network required.

## Closure

- No known P1/P2 defect.
- TypeScript, tests, client/SSR build, Convex push, route generation, Fallow, diff check, live AniList smoke, review, and browser QA pass.
- Stop after Phase 3.
