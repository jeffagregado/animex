import { z } from 'zod'

import { AniListRequestError, requestAniListAllowingNotFound, type AniListDependencies } from '../../../lib/anilist-client.server'
import { animeFormatSchema, slugifyAnimeTitle } from '../../discover/shared/discover-contracts'
import { type AnimeSummary } from '../../discover/shared/discover-contracts'
import {
  ANIME_PEOPLE_PER_PAGE,
  animeCharacterPageSchema,
  animeDetailSchema,
  animeStaffPageSchema,
  parseAnilistId,
  parseAnimePage,
  type AnimeCharacter,
  type AnimeDetail,
  type AnimeDetailListItem,
  type AnimePeopleKind,
  type AnimePeoplePage,
  type AnimeStaff,
} from '../shared/anime-detail-contracts'

const detailDocument = `query AnimeDetail($id: Int!) { Media(id: $id, type: ANIME, isAdult: false) { id type isAdult title { english romaji native } coverImage { extraLarge } bannerImage description format status source season seasonYear episodes duration popularity averageScore trending nextAiringEpisode { airingAt } startDate { year month day } endDate { year month day } genres studios { edges { isMain node { name siteUrl } } } relations { edges { node { id type isAdult title { english romaji native } coverImage { large } format seasonYear } } } recommendations { nodes { mediaRecommendation { id type isAdult title { english romaji native } coverImage { large } format seasonYear } } } trailer { id site thumbnail } externalLinks { site url } } }`
const characterDocument = `query AnimeCharacters($id: Int!, $page: Int!, $perPage: Int!) { Media(id: $id, type: ANIME, isAdult: false) { characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE, ID]) { pageInfo { currentPage hasNextPage } edges { role node { id name { full } image { large } } voiceActorRoles { voiceActor { id name { full } image { large } languageV2 } } } } } }`
const staffDocument = `query AnimeStaff($id: Int!, $page: Int!, $perPage: Int!) { Media(id: $id, type: ANIME, isAdult: false) { staff(page: $page, perPage: $perPage, sort: [RELEVANCE, ID]) { pageInfo { currentPage hasNextPage } edges { role node { id name { full } image { large } } } } } }`

const titleSchema = z.object({ english: z.string().nullable(), romaji: z.string().nullable(), native: z.string().nullable() })
const listMediaSchema = z.object({ id: z.number().int().positive(), type: z.string(), isAdult: z.boolean(), title: titleSchema, coverImage: z.object({ large: z.url().nullable() }).nullable(), format: z.string().nullable(), seasonYear: z.number().int().nullable() })
const detailResponseSchema = z.object({ data: z.object({ Media: z.object({
  id: z.number().int().positive(), type: z.literal('ANIME'), isAdult: z.literal(false), title: titleSchema,
  coverImage: z.object({ extraLarge: z.url().nullable() }).nullable(), bannerImage: z.url().nullable(), description: z.string().nullable(),
  format: z.string().nullable(), status: z.string().nullable(), source: z.string().nullable(), season: z.string().nullable(), seasonYear: z.number().int().nullable(), episodes: z.number().int().nullable(), duration: z.number().int().nullable(), popularity: z.number().int().nonnegative(), averageScore: z.number().int().nullable(), trending: z.number().int().nullable(), nextAiringEpisode: z.object({ airingAt: z.number().int().nonnegative() }).nullable(),
  startDate: z.object({ year: z.number().int().nullable(), month: z.number().int().nullable(), day: z.number().int().nullable() }).nullable(), endDate: z.object({ year: z.number().int().nullable(), month: z.number().int().nullable(), day: z.number().int().nullable() }).nullable(), genres: z.array(z.string()),
  studios: z.object({ edges: z.array(z.object({ isMain: z.boolean(), node: z.object({ name: z.string(), siteUrl: z.url().nullable() }) })) }),
  relations: z.object({ edges: z.array(z.object({ node: listMediaSchema.nullable() })) }), recommendations: z.object({ nodes: z.array(z.object({ mediaRecommendation: listMediaSchema.nullable() })) }),
  trailer: z.object({ id: z.string(), site: z.string(), thumbnail: z.url().nullable() }).nullable(), externalLinks: z.array(z.object({ site: z.string(), url: z.url() })),
}).nullable() }) })

const plainText = (html: string | null): string | null => {
  if (html === null) return null
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
  return text || null
}

const titleParts = (title: z.infer<typeof titleSchema>) => {
  const english = title.english?.trim() || null
  const romaji = title.romaji?.trim() || null
  const native = title.native?.trim() || null
  const display = english ?? romaji ?? native
  if (!display) throw new TypeError('AniList anime requires a title.')
  return { display, english, romaji, native }
}

const listItem = (media: z.infer<typeof listMediaSchema>): AnimeDetailListItem | null => {
  if (media.type !== 'ANIME' || media.isAdult !== false) return null
  const title = titleParts(media.title).display
  return { anilistId: media.id, slug: slugifyAnimeTitle(title), title, coverImageUrl: media.coverImage?.large ?? null, format: animeFormatSchema.nullable().parse(media.format), seasonYear: media.seasonYear }
}

/** Fetches and strictly normalizes public anime metadata. */
export const fetchAnimeDetailCachePayload = async (anilistId: number, dependencies: AniListDependencies): Promise<{ detail: AnimeDetail; summary: AnimeSummary } | null> => {
  const body = await requestAniListAllowingNotFound(detailDocument, { id: parseAnilistId(anilistId) }, dependencies)
  const parsed = detailResponseSchema.safeParse(body)
  if (!parsed.success) throw new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
  const media = parsed.data.data.Media
  if (media === null) return null
  try {
    const titles = titleParts(media.title)
    const [charactersPage, staffPage] = await Promise.all([
      fetchAnimePeoplePageFromAniList(anilistId, 'characters', 1, dependencies),
      fetchAnimePeoplePageFromAniList(anilistId, 'staff', 1, dependencies),
    ])
    if (!charactersPage || !staffPage) throw new TypeError('AniList people pages were missing.')
    const detail = animeDetailSchema.parse({
      anilistId: media.id, slug: slugifyAnimeTitle(titles.display), titles,
      coverImageUrl: media.coverImage?.extraLarge ?? null, bannerImageUrl: media.bannerImage, synopsis: plainText(media.description),
      format: media.format, status: media.status, source: media.source, season: media.season, seasonYear: media.seasonYear,
      episodes: media.episodes, durationMinutes: media.duration, startDate: media.startDate, endDate: media.endDate,
      genres: [...new Set(media.genres.map((genre) => genre.trim()).filter(Boolean))],
      mainStudio: media.studios.edges.find((edge) => edge.isMain) ? { name: media.studios.edges.find((edge) => edge.isMain)!.node.name, siteUrl: media.studios.edges.find((edge) => edge.isMain)!.node.siteUrl } : null,
      related: media.relations.edges.flatMap((edge) => {
        if (!edge.node) return []
        const item = listItem(edge.node)
        return item ? [item] : []
      }).slice(0, 5),
      recommendations: media.recommendations.nodes.flatMap((node) => {
        if (!node.mediaRecommendation) return []
        const item = listItem(node.mediaRecommendation)
        return item ? [item] : []
      }).slice(0, 5),
      trailer: media.trailer?.site.toLowerCase() === 'youtube' ? { youtubeId: media.trailer.id, thumbnailUrl: media.trailer.thumbnail } : null,
      externalLinks: media.externalLinks.filter((link) => link.url.startsWith('https://')).slice(0, 8),
      charactersPage,
      staffPage,
    })
    return { detail, summary: {
      anilistId: detail.anilistId, slug: detail.slug, titles: detail.titles, coverImageUrl: detail.coverImageUrl,
      bannerImageUrl: detail.bannerImageUrl, format: detail.format, season: detail.season, seasonYear: detail.seasonYear,
      episodes: detail.episodes, genres: detail.genres, popularity: media.popularity, averageScore: media.averageScore,
      trending: media.trending, startDate: detail.startDate, nextAiringAt: media.nextAiringEpisode?.airingAt ?? null,
    } }
  } catch (error) {
    if (error instanceof AniListRequestError) throw error
    throw new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
  }
}

/** Fetches full detail with initial Character and Staff pages. */
export const fetchAnimeDetailFromAniList = async (anilistId: number, dependencies: AniListDependencies): Promise<AnimeDetail | null> => {
  const payload = await fetchAnimeDetailCachePayload(anilistId, dependencies)
  return payload?.detail ?? null
}

const peopleResponseSchema = z.object({ data: z.object({ Media: z.record(z.string(), z.unknown()).nullable() }) })
const pageSchema = z.object({ pageInfo: z.object({ currentPage: z.number().int().positive(), hasNextPage: z.boolean() }), edges: z.array(z.object({ role: z.string(), node: z.object({ id: z.number().int().positive(), name: z.object({ full: z.string() }), image: z.object({ large: z.url().nullable() }).nullable() }), voiceActorRoles: z.array(z.object({ voiceActor: z.object({ id: z.number().int().positive(), name: z.object({ full: z.string() }), image: z.object({ large: z.url().nullable() }).nullable(), languageV2: z.string() }) })).optional() })) })

/** Fetches one independent 24-item Character or Staff connection page. */
export const fetchAnimePeoplePageFromAniList = async (anilistId: number, kind: AnimePeopleKind, page: number, dependencies: AniListDependencies): Promise<AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff> | null> => {
  const validId = parseAnilistId(anilistId)
  const validPage = parseAnimePage(page)
  const body = await requestAniListAllowingNotFound(kind === 'characters' ? characterDocument : staffDocument, { id: validId, page: validPage, perPage: ANIME_PEOPLE_PER_PAGE }, dependencies)
  const response = peopleResponseSchema.safeParse(body)
  if (!response.success) throw new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
  if (response.data.data.Media === null) return null
  const parsed = pageSchema.safeParse(response.data.data.Media[kind])
  if (!parsed.success) throw new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
  try {
    const base = { currentPage: parsed.data.pageInfo.currentPage, hasNextPage: parsed.data.pageInfo.hasNextPage, perPage: ANIME_PEOPLE_PER_PAGE }
    if (kind === 'characters') return animeCharacterPageSchema.parse({ ...base, items: parsed.data.edges.map((edge) => {
      const actor = edge.voiceActorRoles?.find((role) => role.voiceActor.languageV2 === 'Japanese')?.voiceActor
      return { anilistId: edge.node.id, name: edge.node.name.full, role: edge.role, imageUrl: edge.node.image?.large ?? null, japaneseVoiceActor: actor ? { anilistId: actor.id, name: actor.name.full, imageUrl: actor.image?.large ?? null, language: 'Japanese' } : null }
    }) })
    return animeStaffPageSchema.parse({ ...base, items: parsed.data.edges.map((edge) => ({ anilistId: edge.node.id, name: edge.node.name.full, role: edge.role, imageUrl: edge.node.image?.large ?? null })) })
  } catch {
    throw new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
  }
}
