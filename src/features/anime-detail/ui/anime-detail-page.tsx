import { AlertTriangleIcon } from 'lucide-react'

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
  const canonicalPath = createCanonicalAnimePath(detail.anilistId, detail.titles.display, tab)
  return <main className="pb-24 md:pb-12"><section className="relative overflow-hidden border-b border-border"><div className="absolute inset-0">{detail.bannerImageUrl ? <AnimeImage alt={`${detail.titles.display} banner`} src={detail.bannerImageUrl} className="h-full w-full object-cover opacity-45" /> : <div role="img" aria-label="Banner unavailable" className="h-full bg-gradient-to-br from-cyan-950/50 to-card" />}</div><div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-background/15" /><div className="relative mx-auto grid max-w-[1480px] gap-6 px-4 py-8 sm:grid-cols-[13rem_1fr] md:px-7 md:py-12"><AnimeImage alt={`${detail.titles.display} cover`} src={detail.coverImageUrl} className="aspect-[2/3] w-44 rounded-xl border border-border object-cover shadow-2xl sm:w-full" /><div className="self-end"><h1 className="text-3xl font-black tracking-tight md:text-4xl">{detail.titles.display}</h1><p className="mt-3 text-muted-foreground">{heroMeta(detail).join(' · ')}</p><p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{detail.synopsis ?? 'Synopsis unavailable.'}</p><div className="mt-5"><AnimeUserControls anilistId={detail.anilistId} canonicalPath={canonicalPath} /></div></div></div></section><div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 md:px-7 lg:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]"><div className="min-w-0"><AnimeDetailTabs detail={detail} tab={tab} onTabChange={onTabChange} /></div><AnimeDetailSidebar detail={detail} /></div></main>
}

function RouteState({ title, message }: { title: string; message: string }) { return <main className="mx-auto grid min-h-[55dvh] max-w-2xl place-items-center px-4 text-center"><div><AlertTriangleIcon className="mx-auto size-10 text-cyan-300" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p></div></main> }

const heroMeta = (detail: AnimeDetail): string[] => [detail.format?.replace('_', ' ') ?? 'Format unknown', detail.seasonYear?.toString() ?? 'Year unknown', ...detail.genres.slice(0, 2), detail.episodes === null ? 'Episodes unknown' : `${detail.episodes} episodes`]
