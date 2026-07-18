import { Fragment, type ReactNode } from 'react'

import { parseCatalogPublicId } from '../../catalog-identity/shared/catalog-identity-contracts'

type CatalogPersonDescriptionProps = {
  description: string
}

type DescriptionPart =
  | { kind: 'link'; label: string; start: number; target: string }
  | { kind: 'strong'; start: number; value: string }
  | { kind: 'text'; start: number; value: string }

type DescriptionLink = { kind: 'external' | 'internal'; href: string }

const DESCRIPTION_TOKEN = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\[([^\]\n]+)\]\(([^)\s]+)\)/g
const INTERNAL_LINK = /^\/(?:anime|characters|staff)\/([^/?#]+)\/[^/?#]+$/
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
  return <a className={LINK_CLASS} href={link.href}>{part.label}</a>
}

/** Accepts only canonical internal paths and safe external URLs. */
function resolveDescriptionLink(_label: string, target: string): DescriptionLink | null {
  const internal = INTERNAL_LINK.exec(target)
  if (internal) {
    try {
      parseCatalogPublicId(internal[1])
      return { kind: 'internal', href: target }
    } catch (error) {
      if (error instanceof RangeError) return null
      throw error
    }
  }
  const url = parseExternalUrl(target)
  if (url === null) return null
  return { kind: 'external', href: target }
}

/** Accepts only absolute HTTP and HTTPS biography URLs. */
function parseExternalUrl(target: string): URL | null {
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
