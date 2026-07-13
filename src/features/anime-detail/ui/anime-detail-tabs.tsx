import type { KeyboardEvent } from 'react'

import type { AnimeDetail, AnimeDetailTab } from '../shared/anime-detail-contracts'
import { AnimePeopleGrid } from './anime-people-grid'

type AnimeDetailTabsProps = { detail: AnimeDetail; tab: AnimeDetailTab; onTabChange: (tab: AnimeDetailTab) => void }
const tabs: { label: string; value: AnimeDetailTab }[] = [{ label: 'Overview', value: 'overview' }, { label: 'Reviews', value: 'reviews' }, { label: 'Characters', value: 'characters' }, { label: 'Staff', value: 'staff' }]

/** Keeps one tablist while swapping only main-column content. */
export function AnimeDetailTabs({ detail, tab, onTabChange }: AnimeDetailTabsProps) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const keyOffsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: tabs.length - 1 - index }
    const offset = keyOffsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = (index + offset + tabs.length) % tabs.length
    onTabChange(tabs[next].value)
    document.getElementById(`anime-tab-${tabs[next].value}`)?.focus()
  }
  return <><nav aria-label="Anime detail tabs" className="grid grid-cols-4 border-b border-border" role="tablist">{tabs.map((item, index) => <button aria-controls={`anime-panel-${item.value}`} aria-selected={tab === item.value} className={`min-h-12 border-b-2 px-2 font-bold focus-visible:ring-2 focus-visible:ring-cyan-300 ${tab === item.value ? 'border-cyan-300 text-cyan-300' : 'border-transparent text-muted-foreground'}`} id={`anime-tab-${item.value}`} key={item.value} onClick={() => onTabChange(item.value)} onKeyDown={(event) => moveFocus(event, index)} role="tab" tabIndex={tab === item.value ? 0 : -1} type="button">{item.label}</button>)}</nav><section aria-labelledby={`anime-tab-${tab}`} className="py-5" id={`anime-panel-${tab}`} role="tabpanel" tabIndex={0}>{tab === 'overview' ? <Overview detail={detail} /> : null}{tab === 'reviews' ? <Reviews /> : null}{tab === 'characters' ? <AnimePeopleGrid anilistId={detail.anilistId} initialPage={detail.charactersPage} kind="characters" /> : null}{tab === 'staff' ? <AnimePeopleGrid anilistId={detail.anilistId} initialPage={detail.staffPage} kind="staff" /> : null}</section></>
}

function Reviews() { return <div className="rounded-xl border border-border bg-card/60 p-8 text-center"><h2 className="text-xl font-black">No reviews yet</h2><p className="mt-2 text-muted-foreground">Average rating unavailable · 0 reviews</p></div> }

function Overview({ detail }: { detail: AnimeDetail }) {
  const values: [string, string][] = [['Format', formatLabel(detail.format)], ['Episodes', detail.episodes?.toString() ?? 'Unknown'], ['Episode Duration', detail.durationMinutes ? `${detail.durationMinutes} min` : 'Unknown'], ['Status', statusLabel(detail.status)], ['Aired', dateRange(detail)], ['Season', detail.season && detail.seasonYear ? `${titleCase(detail.season)} ${detail.seasonYear}` : 'Unknown'], ['Studio', detail.mainStudio?.name ?? 'Unknown'], ['Source', detail.source ? titleCase(detail.source) : 'Unknown'], ['Genres', detail.genres.join(', ') || 'Unknown'], ['English Title', detail.titles.english ?? 'Unknown'], ['Native Title', detail.titles.native ?? 'Unknown']]
  return <dl className="grid gap-x-10 md:grid-cols-2">{values.map(([label, value]) => <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border py-3" key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>
}

const titleCase = (value: string) => value.toLowerCase().replace(/(^|_)(\w)/g, (_match, _prefix, letter: string) => `${_prefix ? ' ' : ''}${letter.toUpperCase()}`)
const formatLabel = (value: AnimeDetail['format']) => value ? value.replace('_', ' ') : 'Unknown'
const statusLabel = (value: AnimeDetail['status']) => value ? titleCase(value) : 'Unknown'
const dateText = (date: AnimeDetail['startDate']) => date?.year ? [date.year, date.month, date.day].filter((item) => item !== null).join('-') : 'Unknown'
const dateRange = (detail: AnimeDetail) => `${dateText(detail.startDate)} to ${dateText(detail.endDate)}`
