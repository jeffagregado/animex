import { Fragment, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { parseAnilistId } from '../../anime-detail/shared/anime-detail-contracts'
import { slugifyAnimeTitle } from '../../discover/shared/discover-contracts'
import {
  parseCatalogPersonId,
  slugifyCatalogPerson,
  type CatalogPersonKind,
} from '../shared/catalog-person-contracts'

type CatalogPersonDescriptionProps = {
  description: string
}

type DescriptionPart =
  | { kind: 'link'; label: string; start: number; target: string }
  | { kind: 'strong'; start: number; value: string }
  | { kind: 'text'; start: number; value: string }

type DescriptionLink =
  | { kind: 'anime'; id: number; slug: string }
  | { kind: 'external'; href: string }
  | { kind: CatalogPersonKind; id: number; slug: string }

const DESCRIPTION_TOKEN = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\[([^\]\n]+)\]\(([^)\s]+)\)/g
const LINK_CLASS = 'break-words font-medium text-cyan-300 underline decoration-cyan-300/50 underline-offset-2 hover:decoration-cyan-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'

/** Renders supported biography formatting without injecting provider HTML. */
export function CatalogPersonDescription({ description }: CatalogPersonDescriptionProps) {
  return <p className="mt-4 whitespace-pre-line break-words leading-7 text-muted-foreground">
    {renderDescription(description)}
  </p>
}

/** Renders one level of parsed biography content. */
function renderDescription(description: string): ReactNode[] {
  return parseDescription(description).map((part) => <Fragment key={part.start}>{renderPart(part)}</Fragment>)
}

/** Splits lightweight emphasis and link tokens from plain biography text. */
function parseDescription(description: string): DescriptionPart[] {
  const parts: DescriptionPart[] = []
  let cursor = 0

  for (const match of description.matchAll(DESCRIPTION_TOKEN)) {
    const start = match.index
    if (start > cursor) {
      parts.push({ kind: 'text', start: cursor, value: description.slice(cursor, start) })
    }

    const strong = match[1] ?? match[2]
    if (strong !== undefined) {
      parts.push({ kind: 'strong', start, value: strong })
    } else {
      parts.push({ kind: 'link', start, label: match[3], target: match[4] })
    }
    cursor = start + match[0].length
  }

  if (cursor < description.length) {
    parts.push({ kind: 'text', start: cursor, value: description.slice(cursor) })
  }

  return parts
}

/** Renders one parsed biography token. */
function renderPart(part: DescriptionPart): ReactNode {
  if (part.kind === 'text') return part.value
  if (part.kind === 'strong') return <strong className="font-bold text-foreground">{renderDescription(part.value)}</strong>

  const link = resolveDescriptionLink(part.label, part.target)
  if (link === null) return part.label
  if (link.kind === 'external') {
    return <a className={LINK_CLASS} href={link.href} rel="noopener noreferrer" target="_blank">{part.label}</a>
  }
  if (link.kind === 'anime') {
    return <Link className={LINK_CLASS} params={{ anilistId: String(link.id), slug: link.slug }} to="/anime/$anilistId/$slug">{part.label}</Link>
  }
  if (link.kind === 'character') {
    return <Link className={LINK_CLASS} params={{ id: String(link.id), slug: link.slug }} to="/characters/$id/$slug">{part.label}</Link>
  }
  return <Link className={LINK_CLASS} params={{ id: String(link.id), slug: link.slug }} to="/staff/$id/$slug">{part.label}</Link>
}

/** Converts supported AniList entity URLs to typed app destinations. */
function resolveDescriptionLink(label: string, target: string): DescriptionLink | null {
  const url = parseDescriptionUrl(target)
  if (url === null) return null
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'anilist.co') return { kind: 'external', href: target }
  return resolveAniListEntityLink(label, url)
}

/** Accepts only parseable HTTP and HTTPS biography URLs. */
function parseDescriptionUrl(target: string): URL | null {
  let url: URL
  try {
    url = new URL(target)
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url
}

/** Resolves one supported AniList entity URL. */
function resolveAniListEntityLink(label: string, url: URL): DescriptionLink | null {
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2 || segments.length > 3) return null
  const [entity, idText] = segments
  const id = Number(idText)

  if (entity === 'anime') return resolveAnimeLink(label, id)
  if (entity === 'character' || entity === 'staff') return resolveCatalogPersonLink(entity, label, id)
  return null
}

/** Builds one validated internal anime link. */
function resolveAnimeLink(label: string, id: number): DescriptionLink | null {
  try {
    return { kind: 'anime', id: parseAnilistId(id), slug: slugifyAnimeTitle(label) }
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return null
    throw error
  }
}

/** Builds one validated internal Character or Staff link. */
function resolveCatalogPersonLink(kind: CatalogPersonKind, label: string, id: number): DescriptionLink | null {
  try {
    return { kind, id: parseCatalogPersonId(id), slug: slugifyCatalogPerson(label) }
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return null
    throw error
  }
}
