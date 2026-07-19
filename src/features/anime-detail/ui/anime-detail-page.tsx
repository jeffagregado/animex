import { AlertTriangleIcon } from 'lucide-react'

import { DetailPageLayout } from '#/components/detail-page-layout'
import { createCanonicalAnimePath, type AnimeDetail, type AnimeDetailTab, type PublicAnimeDetailState } from '../shared/anime-detail-contracts'
import { AnimeDetailSidebar } from './anime-detail-sidebar'
import { AnimeDetailTabs } from './anime-detail-tabs'
import { AnimeImage } from './anime-image'
import { AnimeUserControls } from './anime-user-controls'

type AnimeDetailPageProps = { state: PublicAnimeDetailState; tab: AnimeDetailTab; onTabChange: (tab: AnimeDetailTab) => void }

/** Renders explicit public states or one stable Anime Detail shell. */
export function AnimeDetailPage({ state, tab, onTabChange }: AnimeDetailPageProps) {
  if (state.status === 'loading' || state.status === 'empty') return <RouteState title="Loading anime details…" message="Anime metadata is being prepared." />
  if (state.status === 'not-found') return <RouteState title="Anime not found" message={state.message} />
  if (state.status === 'error' || state.status === 'pagination-error') return <RouteState title={state.code === 'RATE_LIMITED' ? 'AniList rate limit reached' : 'Anime details unavailable'} message={state.message} />
  return <AnimeDetailShell detail={state.entry.detail} tab={tab} onTabChange={onTabChange} />
}

function AnimeDetailShell({ detail, tab, onTabChange }: { detail: AnimeDetail; tab: AnimeDetailTab; onTabChange: (tab: AnimeDetailTab) => void }) {
  const canonicalPath = createCanonicalAnimePath(detail.publicId, detail.titles.display, tab)
  const hero = <section className="relative -mx-4 overflow-hidden border-b border-border md:-mx-7 lg:mx-0"><div className="absolute inset-0">{detail.bannerImageUrl ? <AnimeImage alt={`${detail.titles.display} banner`} src={detail.bannerImageUrl} className="h-full w-full object-cover opacity-55" /> : <div role="img" aria-label="Banner unavailable" className="h-full bg-gradient-to-br from-cyan-950/50 to-card" />}</div><div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-background/10" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" /><div className="relative flex min-h-[36rem] flex-col px-4 py-8 md:min-h-[38rem] md:px-7 md:py-10"><div className="grid flex-1 grid-cols-[minmax(8rem,35vw)_minmax(0,1fr)] items-end gap-5 sm:grid-cols-[13rem_minmax(0,1fr)] md:gap-7"><AnimeImage alt={`${detail.titles.display} cover`} src={detail.coverImageUrl} className="aspect-[2/3] w-full rounded-xl border border-border object-cover shadow-2xl" /><div className="self-end pb-1"><h1 className="text-3xl font-black tracking-tight md:text-4xl">{detail.titles.display}</h1><p className="mt-3 text-sm text-muted-foreground md:text-base">{heroMeta(detail).join(' · ')}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">{detail.synopsis ?? 'Synopsis unavailable.'}</p></div></div><div className="mt-5 md:mt-6"><AnimeUserControls publicId={detail.publicId} canonicalPath={canonicalPath} /></div></div></section>
  return <DetailPageLayout hero={hero} content={<AnimeDetailTabs detail={detail} tab={tab} onTabChange={onTabChange} />} aside={<AnimeDetailSidebar detail={detail} />} />
}

function RouteState({ title, message }: { title: string; message: string }) { return <main className="mx-auto grid min-h-[55dvh] max-w-[1480px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 md:px-7 lg:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]"><section className="grid min-h-80 place-items-center rounded-xl border border-border bg-card/40 p-6 text-center"><div><AlertTriangleIcon className="mx-auto size-10 text-cyan-300" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p></div></section><aside aria-label="Anime detail sidebar loading" className="space-y-4"><div className="h-44 animate-pulse rounded-xl border border-border bg-card/40" /><div className="h-64 animate-pulse rounded-xl border border-border bg-card/40" /></aside></main> }

const heroMeta = (detail: AnimeDetail): string[] => [detail.format?.replace('_', ' ') ?? 'Format unknown', detail.seasonYear?.toString() ?? 'Year unknown', ...detail.genres.slice(0, 2), detail.episodes === null ? 'Episodes unknown' : `${detail.episodes} episodes`]
