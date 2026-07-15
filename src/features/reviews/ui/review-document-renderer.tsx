import { useState, type ReactNode } from 'react'
import { ExternalLinkIcon, EyeOffIcon, ImageOffIcon, PlayIcon } from 'lucide-react'

import { parseReviewDocument, type ReviewDocumentV1 } from '#/features/social/shared/review-document'

type ReviewNode = ReviewDocumentV1['editorState']['root']['children'][number]
type RendererProps = { document: ReviewDocumentV1 }

/** Renders validated Review JSON as semantic React elements only. */
export function ReviewDocumentRenderer({ document }: RendererProps) {
  const body = parseReviewDocument(document)
  return <div className="space-y-4 text-[0.98rem] leading-7 text-foreground">{body.editorState.root.children.map((node, index) => <ReviewNodeView key={`${node.type}-${index}`} node={node} />)}</div>
}

function ReviewNodeView({ node }: { node: ReviewNode }) {
  if (node.type === 'paragraph') return <p>{renderChildren(node.children)}</p>
  if (node.type === 'heading') return node.tag === 'h2' ? <h2 className="text-2xl font-black">{renderChildren(node.children)}</h2> : <h3 className="text-xl font-black">{renderChildren(node.children)}</h3>
  if (node.type === 'quote') return <blockquote className="border-l-2 border-cyan-300 pl-4 italic text-muted-foreground">{renderChildren(node.children)}</blockquote>
  if (node.type === 'listitem') return <li>{renderChildren(node.children)}</li>
  if (node.type === 'list') {
    const items = node.children.map((child, index) => <ReviewNodeView key={`${child.type}-${index}`} node={child} />)
    return node.listType === 'number' ? <ol className="list-decimal space-y-1 pl-6" start={node.start}>{items}</ol> : <ul className="list-disc space-y-1 pl-6 marker:text-cyan-300">{items}</ul>
  }
  if (node.type === 'spoiler') return <SpoilerBlock node={node} />
  if (node.type === 'review-image') return <ReviewImage alt={node.alt} url={node.url} />
  if (node.type === 'review-video') return <ReviewVideo label={node.label} provider={node.provider} url={node.url} />
  if (node.type === 'linebreak') return <br />
  if (node.type === 'text') return renderText(node.text, node.format)
  return null
}

const renderChildren = (children: ReviewNode[]): ReactNode => children.map((child, index) => <ReviewNodeView key={`${child.type}-${index}`} node={child} />)

const renderText = (text: string, format: number): ReactNode => {
  let value: ReactNode = text
  if ((format & 8) !== 0) value = <u>{value}</u>
  if ((format & 4) !== 0) value = <s>{value}</s>
  if ((format & 2) !== 0) value = <em>{value}</em>
  if ((format & 1) !== 0) value = <strong>{value}</strong>
  return value
}

function SpoilerBlock({ node }: { node: Extract<ReviewNode, { type: 'spoiler' }> }) {
  const [revealed, setRevealed] = useState(false)
  return <section className="rounded-lg border border-cyan-400/60 bg-cyan-400/5 p-3"><button aria-expanded={revealed} aria-label={revealed ? 'Cover spoiler' : 'Reveal spoiler'} className="flex min-h-11 w-full items-center gap-3 text-left font-bold text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => setRevealed((value) => !value)} type="button"><EyeOffIcon className="size-5" /><span className="flex-1">This section contains spoilers</span><span aria-hidden="true">{revealed ? '−' : '+'}</span></button>{revealed ? <div className="mt-3 space-y-4">{node.children.map((child, index) => <ReviewNodeView key={`${child.type}-${index}`} node={child} />)}</div> : <p className="text-sm text-muted-foreground">Click to reveal</p>}</section>
}

function ReviewImage({ alt, url }: { alt: string; url: string }) {
  const [failed, setFailed] = useState(false)
  return <figure className="w-full overflow-hidden rounded-lg border border-border bg-card sm:max-w-[65%]">{failed ? <div className="grid aspect-4/5 place-items-center text-muted-foreground"><span className="flex items-center gap-2"><ImageOffIcon className="size-5" />Image unavailable</span></div> : <img alt={alt} className="aspect-4/5 w-full object-cover" onError={() => setFailed(true)} src={url} />}{failed ? <figcaption className="sr-only">{alt}</figcaption> : null}</figure>
}

function ReviewVideo({ label, provider, url }: { label?: string; provider: 'youtube' | 'vimeo' | 'external'; url: string }) {
  const title = label ?? `Open ${provider === 'external' ? new URL(url).hostname : provider} video`
  const thumbnail = provider === 'youtube' ? getYouTubeThumbnail(url) : null
  return <a aria-label={title} className="grid min-h-28 grid-cols-[8rem_1fr] overflow-hidden rounded-lg border border-border bg-card transition hover:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={url} rel="noreferrer noopener" target="_blank">{thumbnail ? <span className="relative"><img alt="" className="h-full w-full object-cover" src={thumbnail} /><PlayIcon aria-hidden="true" className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white" /></span> : <span className="grid place-items-center bg-cyan-300/5"><PlayIcon className="size-8 text-cyan-300" /></span>}<span className="flex min-w-0 items-center gap-3 p-4"><span className="min-w-0 flex-1"><strong className="block break-words">{title}</strong><span className="mt-1 block capitalize text-cyan-300">{provider === 'external' ? new URL(url).hostname : provider}</span></span><ExternalLinkIcon className="size-5 shrink-0 text-cyan-300" /></span></a>
}

/** Derives only validated YouTube IDs; never fetches arbitrary metadata. */
const getYouTubeThumbnail = (value: string): string | null => {
  const url = new URL(value)
  const id = url.hostname.toLowerCase() === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v')
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}
