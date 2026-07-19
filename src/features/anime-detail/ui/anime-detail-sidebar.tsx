import { ChevronRightIcon, ExternalLinkIcon, LinkIcon, PlayIcon } from 'lucide-react'

import { createCanonicalAnimePath, type AnimeDetail } from '../shared/anime-detail-contracts'
import { AnimeImage } from './anime-image'

type AnimeDetailSidebarProps = { detail: AnimeDetail }

/** Renders stable related, recommendation, trailer, and external-link modules. */
export function AnimeDetailSidebar({ detail }: AnimeDetailSidebarProps) {
  return (
    <aside className="space-y-4" aria-label="More anime information">
      <AnimeList title="Related Anime" items={detail.related.slice(0, 5)} />
      <AnimeList title="Recommendations" items={detail.recommendations.slice(0, 5)} />
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 font-black">Trailer</h2>
        {detail.trailer ? <a aria-label="Watch on YouTube" className="group relative block overflow-hidden rounded-lg border border-transparent focus-visible:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`https://www.youtube.com/watch?v=${encodeURIComponent(detail.trailer.youtubeId)}`} target="_blank" rel="noreferrer"><AnimeImage alt={`${detail.titles.display} trailer`} src={detail.trailer.thumbnailUrl} className="aspect-video w-full object-cover transition-opacity group-hover:opacity-80" /><span aria-hidden="true" className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-background/85 text-cyan-300 transition-colors group-hover:bg-cyan-300 group-hover:text-background group-focus-visible:bg-cyan-300 group-focus-visible:text-background"><PlayIcon className="size-6 fill-current" /></span></span></a> : <p className="text-sm text-muted-foreground">No trailer available.</p>}
      </section>
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 font-black">External Links</h2>
        {detail.externalLinks.length ? <ul className="space-y-1">{detail.externalLinks.map((link) => <li key={`${link.site}-${link.url}`}><a className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:bg-cyan-300/10 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={link.url} target="_blank" rel="noreferrer"><LinkIcon aria-hidden="true" className="size-4 shrink-0 text-cyan-300" /><span className="min-w-0 flex-1 truncate">{link.site}</span><ExternalLinkIcon aria-hidden="true" className="size-4 shrink-0 text-cyan-300" /></a></li>)}</ul> : <p className="text-sm text-muted-foreground">No external links available.</p>}
      </section>
    </aside>
  )
}

function AnimeList({ title, items }: { title: string; items: AnimeDetail['related'] }) {
  return <section className="rounded-xl border border-border bg-card/70 p-4"><h2 className="mb-3 font-black">{title}</h2>{items.length ? <ul className="space-y-1">{items.map((item) => <li key={item.publicId}><a className="group flex min-h-16 items-center gap-3 rounded-lg p-1 hover:bg-cyan-300/10 focus-visible:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={createCanonicalAnimePath(item.publicId, item.title, 'overview')}><AnimeImage alt={`${item.title} cover`} src={item.coverImageUrl} className="h-16 w-11 shrink-0 rounded object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold group-hover:text-cyan-300 group-focus-visible:text-cyan-300">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.format?.replace('_', ' ') ?? 'Format unknown'} · {item.seasonYear?.toString() ?? 'Year unknown'}</span></span><ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-cyan-300 group-focus-visible:text-cyan-300" /></a></li>)}</ul> : <p className="text-sm text-muted-foreground">None available.</p>}</section>
}
