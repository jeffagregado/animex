# AnimeX

AnimeX is an anime discovery, tracking, and community app. Users can explore anime, manage their watch activity, rate and review titles, create short posts, and discover characters, staff, and voice actors.

Built as a personal project for practicing full-stack development and API integration.

## Highlights

- Discover trending, seasonal, recommended, and genre-based anime.
- Search Anime, Characters, Staff, and AnimeX users.
- View detailed Anime, Character, Staff, and Voice Actor information.
- Track watch status, progress, scores, and favorite anime.
- Publish ratings and Reviews with summaries, rich text, and spoiler controls.
- Share short Posts through a visibility-aware activity feed.
- Create user profiles with Activity, Reviews, Favorites, and list statistics.
- Use responsive desktop, tablet, and mobile interfaces.
- Sign in through password or Google OAuth with email verification and account recovery.

## Unofficial project notice

AnimeX is an unofficial, independent client project powered by the AniList GraphQL API. It is not affiliated with, endorsed by, or operated by AniList.

This site is intended only for personal and educational use, including practicing API integration and full-stack application development. Anime information, artwork, and related intellectual property belong to their respective owners.

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