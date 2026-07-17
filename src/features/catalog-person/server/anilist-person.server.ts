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
} from '../shared/catalog-person-contracts'
import {
  characterDetailResponseSchema,
  characterSearchResponseSchema,
  characterWorksResponseSchema,
  staffDetailResponseSchema,
  staffSearchResponseSchema,
  staffWorksResponseSchema,
} from './anilist-person.schemas'

const mediaSelection = `id type isAdult title { english romaji native } coverImage { large } bannerImage format season seasonYear episodes genres popularity averageScore trending startDate { year month day } nextAiringEpisode { airingAt }`
const documents = {
  characterDetail: `query CharacterDetail($id: Int!) { Character(id: $id) { id name { full native } image { large } description age gender dateOfBirth { year month day } bloodType } }`,
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

const formatBirthday = (value: { year: number | null; month: number | null; day: number | null } | null): string | null => {
  if (!value) return null
  const { year, month, day } = value
  if (month !== null && day !== null) {
    const calendarYear = year ?? 2000
    const date = new Date(Date.UTC(calendarYear, month - 1, day))
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw upstreamError()
    const monthDay = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date)
    return year === null ? monthDay : `${monthDay}, ${year}`
  }
  if (year !== null && month === null && day === null) return String(year)
  return null
}

const formatActiveYears = (years: number[] | null): string | null => {
  if (years === null || years.length === 0) return null
  if (years.length === 1) return `${years[0]}–Present`
  if (years.length === 2 && years[0]! <= years[1]!) return `${years[0]}–${years[1]}`
  throw upstreamError()
}

const summaryForCatalog = (summary: AnimeSummary): CatalogAnimeSummary => ({
  id: summary.anilistId,
  slug: summary.slug,
  title: summary.titles.display,
  coverImageUrl: summary.coverImageUrl,
  format: summary.format,
  seasonYear: summary.seasonYear,
})

/** Fetches strict Character or Staff detail. */
export const fetchCatalogPersonFromAniList = async (
  kind: CatalogPersonKind,
  id: number,
  dependencies: AniListDependencies,
): Promise<CatalogPersonDetail | null> => {
  const input = personInputSchema.parse({ kind, id: parseCatalogPersonId(id) })
  const body = await requestAniListAllowingNotFound(
    input.kind === 'character' ? documents.characterDetail : documents.staffDetail,
    { id: input.id },
    dependencies,
    input.kind === 'character' ? 'Character' : 'Staff',
  )
  if (isValidatedNotFound(body)) return null
  try {
    if (input.kind === 'character') {
      const parsed = characterDetailResponseSchema.parse(body).data.Character
      if (!parsed) return null
      if (parsed.id !== input.id) throw upstreamError()
      return catalogPersonDetailSchema.parse({
        kind, id: parsed.id, name: parsed.name.full.trim(), nativeName: text(parsed.name.native),
        imageUrl: parsed.image?.large ?? null, description: normalizeDescriptionText(parsed.description),
        age: text(parsed.age), gender: text(parsed.gender), birthday: formatBirthday(parsed.dateOfBirth),
        bloodType: text(parsed.bloodType),
      })
    }
    const parsed = staffDetailResponseSchema.parse(body).data.Staff
    if (!parsed) return null
    if (parsed.id !== input.id) throw upstreamError()
    const occupations = [...new Set(parsed.primaryOccupations.map((value) => value.trim()).filter(Boolean))]
    return catalogPersonDetailSchema.parse({
      kind, id: parsed.id, name: parsed.name.full.trim(), nativeName: text(parsed.name.native),
      imageUrl: parsed.image?.large ?? null, description: normalizeDescriptionText(parsed.description),
      occupations, language: text(parsed.languageV2), hometown: text(parsed.homeTown),
      activeYears: formatActiveYears(parsed.yearsActive),
    })
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
