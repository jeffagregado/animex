export const ANIME_DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const ANIME_DETAIL_LEASE_MS = 30_000
export const ANIME_PEOPLE_LIMIT = 24

type Lease = { leaseId: string; leaseUntil: number }
type TimedPayload<T> = { payload: T; refreshedAt: number; expiresAt: number }
type UnknownRecord = Record<string, unknown>

export class AnimeDetailCachePolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'AnimeDetailCachePolicyError'
  }
}

const failWrite = (code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', message: string): never => {
  throw new AnimeDetailCachePolicyError(code, message)
}

const requireRecord = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', name: string): UnknownRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return failWrite(code, `${name} must be an object.`)
  return value as UnknownRecord
}

const requireText = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', name: string, nullable = false): void => {
  if (nullable && value === null) return
  if (typeof value !== 'string' || !value.trim()) failWrite(code, `${name} must be a non-empty string.`)
}

const requireInteger = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', name: string, minimum: number, nullable = false): void => {
  if (nullable && value === null) return
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) failWrite(code, `${name} is outside its allowed integer range.`)
}

const requireHttps = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', name: string, nullable: boolean): void => {
  if (nullable && value === null) return
  if (typeof value !== 'string') return failWrite(code, `${name} must be an HTTPS URL.`)
  try {
    if (new URL(value).protocol !== 'https:') failWrite(code, `${name} must be an HTTPS URL.`)
  } catch {
    failWrite(code, `${name} must be an HTTPS URL.`)
  }
}

const validateDate = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY', name: string): void => {
  if (value === null) return
  const date = requireRecord(value, code, name)
  if (date.year !== null && (!Number.isInteger(date.year) || typeof date.year !== 'number')) failWrite(code, `${name}.year must be an integer or null.`)
  if (date.month !== null && (typeof date.month !== 'number' || !Number.isInteger(date.month) || date.month < 1 || date.month > 12)) failWrite(code, `${name}.month must be 1 through 12 or null.`)
  if (date.day !== null && (typeof date.day !== 'number' || !Number.isInteger(date.day) || date.day < 1 || date.day > 31)) failWrite(code, `${name}.day must be 1 through 31 or null.`)
}

const validateTitles = (value: unknown, code: 'INVALID_DETAIL' | 'INVALID_SUMMARY'): void => {
  const titles = requireRecord(value, code, 'titles')
  requireText(titles.display, code, 'titles.display')
  requireText(titles.english, code, 'titles.english', true)
  requireText(titles.romaji, code, 'titles.romaji', true)
  requireText(titles.native, code, 'titles.native', true)
}

const validateListItem = (value: unknown): void => {
  const item = requireRecord(value, 'INVALID_DETAIL', 'detail list item')
  requireInteger(item.anilistId, 'INVALID_DETAIL', 'detail list item anilistId', 1)
  requireText(item.slug, 'INVALID_DETAIL', 'detail list item slug')
  requireText(item.title, 'INVALID_DETAIL', 'detail list item title')
  requireHttps(item.coverImageUrl, 'INVALID_DETAIL', 'detail list item coverImageUrl', true)
  requireInteger(item.seasonYear, 'INVALID_DETAIL', 'detail list item seasonYear', 1, true)
}

const validatePerson = (value: unknown, kind: 'characters' | 'staff'): void => {
  const person = requireRecord(value, 'INVALID_DETAIL', `${kind} item`)
  requireInteger(person.anilistId, 'INVALID_DETAIL', `${kind} item anilistId`, 1)
  requireText(person.name, 'INVALID_DETAIL', `${kind} item name`)
  requireText(person.role, 'INVALID_DETAIL', `${kind} item role`)
  requireHttps(person.imageUrl, 'INVALID_DETAIL', `${kind} item imageUrl`, true)
  if (kind === 'characters' && person.japaneseVoiceActor !== null) {
    const actor = requireRecord(person.japaneseVoiceActor, 'INVALID_DETAIL', 'Japanese voice actor')
    requireInteger(actor.anilistId, 'INVALID_DETAIL', 'Japanese voice actor anilistId', 1)
    requireText(actor.name, 'INVALID_DETAIL', 'Japanese voice actor name')
    requireHttps(actor.imageUrl, 'INVALID_DETAIL', 'Japanese voice actor imageUrl', true)
    if (actor.language !== 'Japanese') failWrite('INVALID_DETAIL', 'Japanese voice actor language must be Japanese.')
  }
}

/** Validates detail and summary writes against frozen shared constraints. */
export const validateDetailCommit = (detailValue: unknown, summaryValue: unknown): void => {
  const detail = requireRecord(detailValue, 'INVALID_DETAIL', 'detail')
  const summary = requireRecord(summaryValue, 'INVALID_SUMMARY', 'summary')
  requireInteger(detail.anilistId, 'INVALID_DETAIL', 'detail anilistId', 1)
  requireText(detail.slug, 'INVALID_DETAIL', 'detail slug')
  validateTitles(detail.titles, 'INVALID_DETAIL')
  requireHttps(detail.coverImageUrl, 'INVALID_DETAIL', 'detail coverImageUrl', true)
  requireHttps(detail.bannerImageUrl, 'INVALID_DETAIL', 'detail bannerImageUrl', true)
  requireText(detail.synopsis, 'INVALID_DETAIL', 'detail synopsis', true)
  requireText(detail.source, 'INVALID_DETAIL', 'detail source', true)
  requireInteger(detail.seasonYear, 'INVALID_DETAIL', 'detail seasonYear', 1, true)
  requireInteger(detail.episodes, 'INVALID_DETAIL', 'detail episodes', 0, true)
  requireInteger(detail.durationMinutes, 'INVALID_DETAIL', 'detail durationMinutes', 1, true)
  validateDate(detail.startDate, 'INVALID_DETAIL', 'detail startDate')
  validateDate(detail.endDate, 'INVALID_DETAIL', 'detail endDate')
  const detailGenres = detail.genres
  if (!Array.isArray(detailGenres)) return failWrite('INVALID_DETAIL', 'Detail genres must be an array.')
  detailGenres.forEach((genre: unknown) => requireText(genre, 'INVALID_DETAIL', 'detail genre'))
  if (detail.mainStudio !== null) {
    const studio = requireRecord(detail.mainStudio, 'INVALID_DETAIL', 'mainStudio')
    requireText(studio.name, 'INVALID_DETAIL', 'mainStudio.name')
    requireHttps(studio.siteUrl, 'INVALID_DETAIL', 'mainStudio.siteUrl', true)
  }
  const related = detail.related
  const recommendations = detail.recommendations
  if (!Array.isArray(related)) return failWrite('INVALID_DETAIL', 'Related anime must be an array.')
  if (related.length > 5) failWrite('INVALID_DETAIL', 'Related anime cannot exceed five items.')
  if (!Array.isArray(recommendations)) return failWrite('INVALID_DETAIL', 'Recommendations must be an array.')
  if (recommendations.length > 5) failWrite('INVALID_DETAIL', 'Recommendations cannot exceed five items.')
  related.forEach(validateListItem)
  recommendations.forEach(validateListItem)
  if (detail.trailer !== null) {
    const trailer = requireRecord(detail.trailer, 'INVALID_DETAIL', 'trailer')
    requireText(trailer.youtubeId, 'INVALID_DETAIL', 'trailer.youtubeId')
    requireHttps(trailer.thumbnailUrl, 'INVALID_DETAIL', 'trailer.thumbnailUrl', true)
  }
  const externalLinks = detail.externalLinks
  if (!Array.isArray(externalLinks)) return failWrite('INVALID_DETAIL', 'External links must be an array.')
  if (externalLinks.length > 8) failWrite('INVALID_DETAIL', 'External links cannot exceed eight items.')
  externalLinks.forEach((value: unknown) => {
    const link = requireRecord(value, 'INVALID_DETAIL', 'external link')
    requireText(link.site, 'INVALID_DETAIL', 'external link site')
    requireHttps(link.url, 'INVALID_DETAIL', 'external link url', false)
  })
  for (const kind of ['characters', 'staff'] as const) {
    const page = requireRecord(detail[`${kind}Page`], 'INVALID_DETAIL', `${kind}Page`)
    const items = page.items
    if (page.currentPage !== 1 || page.perPage !== 24 || !Array.isArray(items)) return failWrite('INVALID_DETAIL', `Initial ${kind} page is invalid.`)
    validatePeoplePage(detail.anilistId as number, kind, 1, items)
  }

  requireInteger(summary.anilistId, 'INVALID_SUMMARY', 'summary anilistId', 1)
  if (summary.anilistId !== detail.anilistId) failWrite('INVALID_SUMMARY', 'Summary and detail identities must match.')
  requireText(summary.slug, 'INVALID_SUMMARY', 'summary slug')
  validateTitles(summary.titles, 'INVALID_SUMMARY')
  requireHttps(summary.coverImageUrl, 'INVALID_SUMMARY', 'summary coverImageUrl', true)
  requireHttps(summary.bannerImageUrl, 'INVALID_SUMMARY', 'summary bannerImageUrl', true)
  requireInteger(summary.seasonYear, 'INVALID_SUMMARY', 'summary seasonYear', 1, true)
  requireInteger(summary.episodes, 'INVALID_SUMMARY', 'summary episodes', 0, true)
  requireInteger(summary.popularity, 'INVALID_SUMMARY', 'summary popularity', 0)
  requireInteger(summary.averageScore, 'INVALID_SUMMARY', 'summary averageScore', 0, true)
  if (typeof summary.averageScore === 'number' && summary.averageScore > 100) failWrite('INVALID_SUMMARY', 'Summary averageScore cannot exceed 100.')
  requireInteger(summary.trending, 'INVALID_SUMMARY', 'summary trending', 0, true)
  validateDate(summary.startDate, 'INVALID_SUMMARY', 'summary startDate')
  requireInteger(summary.nextAiringAt, 'INVALID_SUMMARY', 'summary nextAiringAt', 0, true)
  const summaryGenres = summary.genres
  if (!Array.isArray(summaryGenres)) return failWrite('INVALID_SUMMARY', 'Summary genres must be an array.')
  summaryGenres.forEach((genre: unknown) => requireText(genre, 'INVALID_SUMMARY', 'summary genre'))
}

export const createDetailTiming = (now: number) => ({
  refreshedAt: now,
  expiresAt: now + ANIME_DETAIL_CACHE_TTL_MS,
})

/** Returns fresh cache data and never exposes expired data. */
export const resolveDetailRead = <T>(entry: TimedPayload<T> | null, now: number) => {
  if (!entry) return { status: 'missing' as const, entry: null }
  if (entry.expiresAt <= now) return { status: 'expired' as const, entry: null }
  return { status: 'fresh' as const, entry }
}

/** Selects one refresh lease owner. */
export const decideDetailLease = (
  current: Lease | null,
  leaseId: string,
  now: number,
  leaseUntil: number,
) => {
  if (!leaseId.trim()) throw new AnimeDetailCachePolicyError('INVALID_LEASE_ID', 'Lease ID is required.')
  if (leaseUntil <= now) throw new AnimeDetailCachePolicyError('INVALID_LEASE_WINDOW', 'Lease window must end in the future.')
  if (current && current.leaseUntil > now && current.leaseId !== leaseId) {
    return { acquired: false, leaseUntil: current.leaseUntil }
  }
  return { acquired: true, leaseUntil }
}

/** Requires an active lease held by the caller. */
export const assertDetailLease: (current: Lease | null, leaseId: string, now: number) => asserts current is Lease = (
  current,
  leaseId,
  now,
) => {
  if (!current || current.leaseUntil <= now) throw new AnimeDetailCachePolicyError('LEASE_NOT_ACTIVE', 'Anime detail cache lease is missing or expired.')
  if (current.leaseId !== leaseId) throw new AnimeDetailCachePolicyError('LEASE_NOT_OWNED', 'Anime detail cache lease belongs to another worker.')
}

/** Allows only the active owner to release a lease. */
export const decideDetailLeaseRelease = (current: Lease | null, leaseId: string, now: number): boolean => {
  if (!current || current.leaseUntil <= now) return false
  if (current.leaseId === leaseId) return true
  throw new AnimeDetailCachePolicyError('LEASE_NOT_OWNED', 'Anime detail cache lease belongs to another worker.')
}

/** Validates bounded people-page identity and size. */
export const validatePeoplePage = (
  anilistId: number,
  kind: 'characters' | 'staff',
  page: number,
  items: unknown[],
): void => {
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) throw new AnimeDetailCachePolicyError('INVALID_ANILIST_ID', 'AniList ID must be a positive safe integer.')
  if (!Number.isSafeInteger(page) || page <= 0) throw new AnimeDetailCachePolicyError('INVALID_PAGE', 'Page must be a positive safe integer.')
  if (items.length > ANIME_PEOPLE_LIMIT) throw new AnimeDetailCachePolicyError('PEOPLE_PAGE_LIMIT_EXCEEDED', 'Anime people page cannot exceed 24 items.')
  const characterItemCount = items.filter((item) => typeof item === 'object' && item !== null && 'japaneseVoiceActor' in item).length
  if ((kind === 'characters' && characterItemCount !== items.length) || (kind === 'staff' && characterItemCount > 0)) {
    throw new AnimeDetailCachePolicyError('INVALID_PEOPLE_KIND', `Anime people page items do not match ${kind} kind.`)
  }
  items.forEach((item) => validatePerson(item, kind))
}
