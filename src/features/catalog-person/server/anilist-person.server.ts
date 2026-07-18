import { z } from 'zod'

import {
  AniListRequestError,
  requestAniList,
  requestAniListAllowingNotFound,
  type AniListDependencies,
} from '../../../lib/anilist-client.server'
import { normalizeDescriptionText } from '../../anime-detail/server/anilist-detail.server'
import { normalizeAnimeSummary, type AnimeSummary } from '../../discover/shared/discover-contracts'
import {
  CATALOG_PERSON_PAGE_SIZE,
  catalogPersonDetailSchema,
  catalogPersonSearchPageSchema,
  catalogPersonWorkPageSchema,
  createCatalogPersonPath,
  parseCatalogPersonId,
  type CatalogAnimeSummary,
  type CatalogPersonDetail,
  type CatalogPersonKind,
  type CatalogPersonSearchPage,
  type CatalogPersonWorkPage,
  type CatalogVoiceActor,
} from '../shared/catalog-person-contracts'
import {
  characterDetailResponseSchema,
  characterSearchResponseSchema,
  characterVoiceActorsResponseSchema,
  characterWorksResponseSchema,
  staffDetailResponseSchema,
  staffSearchResponseSchema,
  staffWorksResponseSchema,
} from './anilist-person.schemas'

const mediaSelection = `id type isAdult title { english romaji native } coverImage { large } bannerImage format season seasonYear episodes genres popularity averageScore trending startDate { year month day } nextAiringEpisode { airingAt }`
const voiceActorMediaSelection = `pageInfo { currentPage hasNextPage } edges { node { isAdult } voiceActorRoles { voiceActor { id name { full } image { large } languageV2 } } }`
const VOICE_ACTOR_MEDIA_PAGE_SIZE = 25
const documents = {
  characterDetail: `query CharacterDetail($id: Int!, $page: Int!, $perPage: Int!) { Character(id: $id) { id name { full native } image { large } description age gender dateOfBirth { year month day } bloodType media(type: ANIME, page: $page, perPage: $perPage, sort: [POPULARITY_DESC, ID]) { ${voiceActorMediaSelection} } } }`,
  characterVoiceActors: `query CharacterVoiceActors($id: Int!, $page: Int!, $perPage: Int!) { Character(id: $id) { id media(type: ANIME, page: $page, perPage: $perPage, sort: [POPULARITY_DESC, ID]) { ${voiceActorMediaSelection} } } }`,
  staffDetail: `query StaffDetail($id: Int!) { Staff(id: $id) { id name { full native } image { large } description primaryOccupations languageV2 homeTown yearsActive } }`,
  characterWorks: `query CharacterWorks($id: Int!, $page: Int!, $perPage: Int!) { Character(id: $id) { id media(type: ANIME, page: $page, perPage: $perPage, sort: [POPULARITY_DESC, ID]) { pageInfo { currentPage hasNextPage } edges { characterRole node { ${mediaSelection} } } } } }`,
  staffWorks: `query StaffWorks($id: Int!, $page: Int!, $perPage: Int!) { Staff(id: $id) { id staffMedia(type: ANIME, page: $page, perPage: $perPage, sort: [POPULARITY_DESC, ID]) { pageInfo { currentPage hasNextPage } edges { staffRole node { ${mediaSelection} } } } } }`,
  characterSearch: `query CharacterSearch($query: String!, $page: Int!, $perPage: Int!) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage } characters(search: $query, sort: SEARCH_MATCH) { id name { full native } image { large } } } }`,
  staffSearch: `query StaffSearch($query: String!, $page: Int!, $perPage: Int!) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage } staff(search: $query, sort: SEARCH_MATCH) { id name { full native } image { large } } } }`,
} as const

const upstreamError = (): AniListRequestError => new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)
const text = (value: string | null): string | null => value?.trim() || null
const isValidatedNotFound = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && 'errors' in body
const personInputSchema = z.object({
  kind: z.enum(['character', 'staff']),
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict()
const pageSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const searchInputSchema = z.object({
  query: z.string().transform((value) => value.trim()).pipe(z.string().min(2).max(100)),
  page: pageSchema,
}).strict()

type PersonBirthday = { year: number | null; month: number | null; day: number | null }
type CompleteMonthDay = PersonBirthday & { month: number; day: number }
type CharacterDetailPayload = NonNullable<
  z.infer<typeof characterDetailResponseSchema>['data']['Character']
>
type CharacterVoiceActorMedia = CharacterDetailPayload['media']

const hasMonthDay = (value: PersonBirthday): value is CompleteMonthDay => (
  [value.month, value.day].every((part) => part !== null)
)

const formatPartialBirthday = (value: PersonBirthday): string | null => (
  value.year !== null && value.month === null && value.day === null
    ? String(value.year)
    : null
)

const formatMonthDay = (value: CompleteMonthDay): string => {
  const calendarYear = value.year ?? 2000
  const date = new Date(Date.UTC(calendarYear, value.month - 1, value.day))
  const dateMatches = date.getUTCMonth() === value.month - 1
    && date.getUTCDate() === value.day
  if (!dateMatches) throw upstreamError()
  return new Intl.DateTimeFormat(
    'en',
    { month: 'long', day: 'numeric', timeZone: 'UTC' },
  ).format(date)
}

const formatBirthday = (value: PersonBirthday | null): string | null => {
  if (!value) return null
  if (!hasMonthDay(value)) return formatPartialBirthday(value)
  const monthDay = formatMonthDay(value)
  return value.year === null ? monthDay : `${monthDay}, ${value.year}`
}

const formatActiveYears = (years: number[] | null): string | null => {
  if (years === null || years.length === 0) return null
  if (years.length === 1) return `${years[0]}–Present`
  if (years.length === 2 && years[0]! <= years[1]!) return `${years[0]}–${years[1]}`
  throw upstreamError()
}

/** Keeps first-seen actors from all non-adult Character anime roles. */
const normalizeVoiceActors = (
  mediaPages: CharacterVoiceActorMedia[],
): CatalogVoiceActor[] => {
  const actors = new Map<number, CatalogVoiceActor>()
  for (const media of mediaPages) {
    for (const edge of media.edges) {
      if (edge.node.isAdult) continue
      for (const role of edge.voiceActorRoles) {
        const actor = role.voiceActor
        if (actors.has(actor.id)) continue
        actors.set(actor.id, {
          id: actor.id,
          name: actor.name.full.trim(),
          imageUrl: actor.image?.large ?? null,
          language: actor.languageV2,
        })
      }
    }
  }
  return [...actors.values()]
}

/** Fetches every remaining Character media page used by voice-actor roles. */
const fetchVoiceActorMediaPages = async (
  id: number,
  firstPage: CharacterVoiceActorMedia,
  dependencies: AniListDependencies,
): Promise<CharacterVoiceActorMedia[]> => {
  if (firstPage.pageInfo.currentPage !== 1) throw upstreamError()
  const pages = [firstPage]
  let current = firstPage
  while (current.pageInfo.hasNextPage) {
    const page = current.pageInfo.currentPage + 1
    const body = await requestAniList(
      documents.characterVoiceActors,
      { id, page, perPage: VOICE_ACTOR_MEDIA_PAGE_SIZE },
      dependencies,
    )
    const character = characterVoiceActorsResponseSchema.parse(body).data.Character
    if (!character || character.id !== id || character.media.pageInfo.currentPage !== page) {
      throw upstreamError()
    }
    pages.push(character.media)
    current = character.media
  }
  return pages
}

const summaryForCatalog = (summary: AnimeSummary): CatalogAnimeSummary => ({
  id: summary.anilistId,
  slug: summary.slug,
  title: summary.titles.display,
  coverImageUrl: summary.coverImageUrl,
  format: summary.format,
  seasonYear: summary.seasonYear,
})

/** Validates and normalizes complete Character detail. */
const parseCharacterDetail = async (
  body: unknown,
  id: number,
  dependencies: AniListDependencies,
): Promise<CatalogPersonDetail | null> => {
  const parsed = characterDetailResponseSchema.parse(body).data.Character
  if (!parsed) return null
  if (parsed.id !== id) throw upstreamError()
  const mediaPages = await fetchVoiceActorMediaPages(parsed.id, parsed.media, dependencies)
  return catalogPersonDetailSchema.parse({
    kind: 'character', id: parsed.id, name: parsed.name.full.trim(), nativeName: text(parsed.name.native),
    imageUrl: parsed.image?.large ?? null, description: normalizeDescriptionText(parsed.description),
    age: text(parsed.age), gender: text(parsed.gender), birthday: formatBirthday(parsed.dateOfBirth),
    bloodType: text(parsed.bloodType), voiceActorScope: 'all-languages',
    voiceActors: normalizeVoiceActors(mediaPages),
  })
}

/** Validates and normalizes Staff detail. */
const parseStaffDetail = (body: unknown, id: number): CatalogPersonDetail | null => {
  const parsed = staffDetailResponseSchema.parse(body).data.Staff
  if (!parsed) return null
  if (parsed.id !== id) throw upstreamError()
  const occupations = [...new Set(parsed.primaryOccupations.map((value) => value.trim()).filter(Boolean))]
  return catalogPersonDetailSchema.parse({
    kind: 'staff', id: parsed.id, name: parsed.name.full.trim(), nativeName: text(parsed.name.native),
    imageUrl: parsed.image?.large ?? null, description: normalizeDescriptionText(parsed.description),
    occupations, language: text(parsed.languageV2), hometown: text(parsed.homeTown),
    activeYears: formatActiveYears(parsed.yearsActive),
  })
}

/** Fetches strict Character or Staff detail. */
export const fetchCatalogPersonFromAniList = async (
  kind: CatalogPersonKind,
  id: number,
  dependencies: AniListDependencies,
): Promise<CatalogPersonDetail | null> => {
  const input = personInputSchema.parse({ kind, id: parseCatalogPersonId(id) })
  const body = await requestAniListAllowingNotFound(
    input.kind === 'character' ? documents.characterDetail : documents.staffDetail,
    input.kind === 'character'
      ? { id: input.id, page: 1, perPage: VOICE_ACTOR_MEDIA_PAGE_SIZE }
      : { id: input.id },
    dependencies,
    input.kind === 'character' ? 'Character' : 'Staff',
  )
  if (isValidatedNotFound(body)) return null
  try {
    return input.kind === 'character'
      ? await parseCharacterDetail(body, input.id, dependencies)
      : parseStaffDetail(body, input.id)
  } catch (error) {
    if (error instanceof AniListRequestError) throw error
    throw upstreamError()
  }
}

/** Fetches strict ordered work page plus full cache summaries. */
export const fetchCatalogPersonWorksFromAniList = async (
  kind: CatalogPersonKind,
  id: number,
  page: number,
  dependencies: AniListDependencies,
): Promise<{ page: CatalogPersonWorkPage; summaries: AnimeSummary[] } | null> => {
  const input = personInputSchema.parse({ kind, id: parseCatalogPersonId(id) })
  const validPage = pageSchema.parse(page)
  const body = await requestAniListAllowingNotFound(
    kind === 'character' ? documents.characterWorks : documents.staffWorks,
    { id: input.id, page: validPage, perPage: CATALOG_PERSON_PAGE_SIZE },
    dependencies,
    kind === 'character' ? 'Character' : 'Staff',
  )
  if (isValidatedNotFound(body)) return null
  try {
    const person = kind === 'character'
      ? characterWorksResponseSchema.parse(body).data.Character
      : staffWorksResponseSchema.parse(body).data.Staff
    if (!person) return null
    if (person.id !== input.id) throw upstreamError()
    const parsed = 'media' in person ? person.media : person.staffMedia
    if (parsed.pageInfo.currentPage !== validPage) throw upstreamError()
    const edges = parsed.edges.filter((edge) => !edge.node.isAdult).map((edge) => ({
      summary: normalizeAnimeSummary(edge.node),
      role: 'characterRole' in edge ? text(edge.characterRole) : text(edge.staffRole),
    }))
    const summaries = new Map<number, AnimeSummary>()
    for (const edge of edges) summaries.set(edge.summary.anilistId, edge.summary)
    return {
      page: catalogPersonWorkPageSchema.parse({
        items: edges.map(({ summary, role }) => ({ anime: summaryForCatalog(summary), role })),
        currentPage: parsed.pageInfo.currentPage,
        hasNextPage: parsed.pageInfo.hasNextPage,
        perPage: CATALOG_PERSON_PAGE_SIZE,
      }),
      summaries: [...summaries.values()],
    }
  } catch (error) {
    if (error instanceof AniListRequestError) throw error
    throw upstreamError()
  }
}

/** Searches Character or Staff without persistent cache. */
export const searchCatalogPeopleFromAniList = async (
  kind: CatalogPersonKind,
  query: string,
  page: number,
  dependencies: AniListDependencies,
): Promise<CatalogPersonSearchPage> => {
  const input = searchInputSchema.parse({ query, page })
  const body = await requestAniList(
    kind === 'character' ? documents.characterSearch : documents.staffSearch,
    { query: input.query, page: input.page, perPage: CATALOG_PERSON_PAGE_SIZE },
    dependencies,
  )
  try {
    const parsed = kind === 'character'
      ? characterSearchResponseSchema.parse(body).data.Page
      : staffSearchResponseSchema.parse(body).data.Page
    if (parsed.pageInfo.currentPage !== input.page) throw upstreamError()
    const people = 'characters' in parsed ? parsed.characters : parsed.staff
    return catalogPersonSearchPageSchema.parse({
      items: people.map((person) => {
        const name = person.name.full.trim()
        return {
          kind, id: person.id, name, nativeName: text(person.name.native),
          imageUrl: person.image?.large ?? null,
          destination: createCatalogPersonPath(kind, person.id, name),
        }
      }),
      currentPage: parsed.pageInfo.currentPage,
      hasNextPage: parsed.pageInfo.hasNextPage,
      perPage: CATALOG_PERSON_PAGE_SIZE,
    })
  } catch {
    throw upstreamError()
  }
}
