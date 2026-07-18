import type { KeyboardEvent } from 'react'

import { DetailPageLayout } from '#/components/detail-page-layout'
import { AnimeImage } from '#/features/anime-detail/ui/anime-image'
import type { CatalogPersonDetail, CatalogPersonKind, CatalogPersonTab } from '../shared/catalog-person-contracts'
import { CatalogPersonDescription } from './catalog-person-description'
import type { CatalogPersonPageState } from './catalog-person-route'
import { CatalogPersonWorkGrid } from './catalog-person-work-grid'

type CatalogPersonPageProps = {
  id: number
  kind: CatalogPersonKind
  state: CatalogPersonPageState
  tab: CatalogPersonTab
  onRetry: () => void
  onTabChange: (tab: CatalogPersonTab) => void
}
type Fact = { label: string; value: string }

const PERSON_TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Anime', value: 'anime' },
] as const

/** Renders explicit detail states and one kind-safe Character or Staff page. */
export function CatalogPersonPage(props: CatalogPersonPageProps) {
  const label = props.kind === 'character' ? 'Character' : 'Staff member'
  if (props.state.status === 'loading') {
    return <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground"><p>Loading {props.kind}…</p></main>
  }
  if (props.state.status === 'not-found') {
    return <main className="mx-auto max-w-7xl px-4 py-16 text-center"><h1 className="text-2xl font-black">{label} not found.</h1><p className="mt-2 text-muted-foreground">This catalog identity is unavailable.</p></main>
  }
  if (props.state.status === 'error') {
    return <main className="mx-auto max-w-7xl px-4 py-16"><div className="mx-auto max-w-xl rounded-xl border border-red-400/40 bg-red-400/10 p-6" role="alert"><h1 className="text-xl font-black">Could not load {props.kind}.</h1><p className="mt-2">{props.state.message}</p><button className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={props.onRetry} type="button">Retry</button></div></main>
  }

  const detail = props.state.entry.detail
  if (detail.kind !== props.kind || detail.id !== props.id) {
    return <main className="mx-auto max-w-7xl px-4 py-16"><div className="rounded-xl border border-red-400/40 bg-red-400/10 p-6" role="alert"><p>Catalog person type did not match this destination.</p><button className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold" onClick={props.onRetry} type="button">Retry</button></div></main>
  }

  const content = <>
    <PersonTabs kind={props.kind} onTabChange={props.onTabChange} tab={props.tab} />
    <section aria-labelledby={`catalog-person-tab-${props.tab}`} className="py-6" id={`catalog-person-panel-${props.tab}`} role="tabpanel" tabIndex={0}>
      {props.tab === 'overview' ? <PersonOverview detail={detail} /> : <CatalogPersonWorkGrid kind={props.kind} personId={props.id} />}
    </section>
  </>
  return <DetailPageLayout hero={<PersonHeader detail={detail} />} content={content} aside={<PersonFacts detail={detail} />} />
}

function PersonHeader({ detail }: { detail: CatalogPersonDetail }) {
  return <header className="relative isolate overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cyan-950 via-background to-violet-950 p-5 sm:p-8">
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_45%)]" />
    <div className="grid items-end gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
      {detail.imageUrl
        ? <AnimeImage alt={`${detail.name} portrait`} className="aspect-[2/3] w-36 rounded-xl border border-white/15 object-cover shadow-xl sm:w-44" src={detail.imageUrl} />
        : <div aria-label={`${detail.name} portrait unavailable`} className="aspect-[2/3] w-36 rounded-xl border border-white/15 bg-gradient-to-br from-cyan-500/30 to-violet-500/20 sm:w-44" role="img" />}
      <div className="min-w-0 pb-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{detail.kind === 'character' ? 'Character' : 'Staff'}</p><h1 className="mt-2 break-words text-3xl font-black tracking-tight sm:text-5xl">{detail.name}</h1>{detail.nativeName ? <p className="mt-2 text-lg text-muted-foreground">{detail.nativeName}</p> : null}</div>
    </div>
  </header>
}

function PersonTabs({ kind, onTabChange, tab }: { kind: CatalogPersonKind; onTabChange: (tab: CatalogPersonTab) => void; tab: CatalogPersonTab }) {
  const select = (value: CatalogPersonTab): void => onTabChange(value)
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: PERSON_TABS.length - 1 - index }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = (index + offset + PERSON_TABS.length) % PERSON_TABS.length
    select(PERSON_TABS[next].value)
    document.getElementById(`catalog-person-tab-${PERSON_TABS[next].value}`)?.focus()
  }
  return <nav aria-label={`${kind} detail tabs`} className="mt-6 grid grid-cols-2 border-b border-border" role="tablist">{PERSON_TABS.map((item, index) => <button aria-controls={`catalog-person-panel-${item.value}`} aria-selected={tab === item.value} className={`min-h-11 border-b-2 px-4 py-3 font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${tab === item.value ? 'border-cyan-300 text-cyan-300' : 'border-transparent text-muted-foreground'}`} id={`catalog-person-tab-${item.value}`} key={item.value} onClick={() => select(item.value)} onKeyDown={(event) => move(event, index)} role="tab" tabIndex={tab === item.value ? 0 : -1} type="button">{item.label}</button>)}</nav>
}

function PersonOverview({ detail }: { detail: CatalogPersonDetail }) {
  return <section aria-labelledby="catalog-person-about"><h2 className="text-xl font-black" id="catalog-person-about">About</h2>{detail.description ? <CatalogPersonDescription description={detail.description} /> : <p className="mt-4 rounded-xl border border-border bg-card/60 p-5 text-muted-foreground">No biography available.</p>}</section>
}

function PersonFacts({ detail }: { detail: CatalogPersonDetail }) {
  const facts = getFacts(detail)
  return <aside aria-labelledby="catalog-person-facts" className="py-6"><h2 className="text-xl font-black" id="catalog-person-facts">Facts</h2>{facts.length > 0 ? <dl className="mt-3">{facts.map((fact) => <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-border py-3" key={fact.label}><dt className="text-muted-foreground">{fact.label}</dt><dd className="break-words">{fact.value}</dd></div>)}</dl> : <p className="mt-4 rounded-xl border border-border bg-card/60 p-5 text-muted-foreground">No {detail.kind} facts available.</p>}</aside>
}

/** Returns only provider-present facts in stable display order. */
function getFacts(detail: CatalogPersonDetail): Fact[] {
  const pairs: Array<[string, string | null]> = detail.kind === 'character'
    ? [['Age', detail.age], ['Gender', detail.gender], ['Birthday', detail.birthday], ['Blood type', detail.bloodType]]
    : [['Occupations', detail.occupations.length > 0 ? detail.occupations.join(', ') : null], ['Language', detail.language], ['Hometown', detail.hometown], ['Active years', detail.activeYears]]
  return pairs.flatMap(([label, value]) => value ? [{ label, value }] : [])
}
