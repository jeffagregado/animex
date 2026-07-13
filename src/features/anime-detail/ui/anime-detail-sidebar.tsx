import { ExternalLinkIcon, PlayCircleIcon } from 'lucide-react'

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
        {detail.trailer ? <a className="group block overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-cyan-300" href={`https://www.youtube.com/watch?v=${encodeURIComponent(detail.trailer.youtubeId)}`} target="_blank" rel="noreferrer"><AnimeImage alt={`${detail.titles.display} trailer`} src={detail.trailer.thumbnailUrl} className="aspect-video w-full object-cover" /><span className="mt-2 flex min-h-11 items-center gap-2 text-cyan-300"><PlayCircleIcon className="size-5" />Watch on YouTube</span></a> : <p className="text-sm text-muted-foreground">No trailer available.</p>}
      </section>
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 font-black">External Links</h2>
        {detail.externalLinks.length ? <ul className="space-y-2">{detail.externalLinks.map((link) => <li key={`${link.site}-${link.url}`}><a className="flex min-h-11 items-center justify-between rounded-lg border border-border px-3 text-sm hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300" href={link.url} target="_blank" rel="noreferrer">{link.site}<ExternalLinkIcon aria-hidden="true" className="size-4 text-cyan-300" /></a></li>)}</ul> : <p className="text-sm text-muted-foreground">No external links available.</p>}
      </section>
    </aside>
  )
}

function AnimeList({ title, items }: { title: string; items: AnimeDetail['related'] }) {
  return <section className="rounded-xl border border-border bg-card/70 p-4"><h2 className="mb-3 font-black">{title}</h2>{items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.anilistId}><a className="flex min-h-16 gap-3 rounded-lg p-1 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300" href={createCanonicalAnimePath(item.anilistId, item.title, 'overview')}><AnimeImage alt={`${item.title} cover`} src={item.coverImageUrl} className="h-16 w-11 shrink-0 rounded object-cover" /><span className="self-center text-sm font-bold">{item.title}</span></a></li>)}</ul> : <p className="text-sm text-muted-foreground">None available.</p>}</section>
}
