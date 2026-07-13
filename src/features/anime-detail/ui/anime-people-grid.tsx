import { useState } from 'react'

import { getAnimePeoplePage } from '../server/anime-detail.functions'
import type { AnimeCharacter, AnimePeopleKind, AnimePeoplePage, AnimeStaff } from '../shared/anime-detail-contracts'
import { AnimeImage } from './anime-image'

type Person = AnimeCharacter | AnimeStaff
type AnimePeopleGridProps = { anilistId: number; initialPage: AnimePeoplePage<Person>; kind: AnimePeopleKind }

/** Appends deduplicated people pages while keeping successful cards on failure. */
export function AnimePeopleGrid({ anilistId, initialPage, kind }: AnimePeopleGridProps) {
  const [items, setItems] = useState<Person[]>(initialPage.items)
  const [page, setPage] = useState(initialPage.currentPage)
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMore = async (): Promise<void> => {
    setPending(true); setError(null)
    try {
      const state = await getAnimePeoplePage({ data: { anilistId, kind, page: page + 1 } })
      if (state.status !== 'ready') throw new Error(state.status === 'error' ? state.message : 'People page unavailable.')
      const next = state.page
      setItems((current) => [...current, ...next.items.filter((item) => !current.some((existing) => existing.anilistId === item.anilistId))])
      setPage(next.currentPage); setHasNextPage(next.hasNextPage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'People page request failed.')
    } finally { setPending(false) }
  }

  return <div>{kind === 'staff' ? <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-cyan-300">Primary Production</h2> : null}{items.length === 0 ? <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No {kind} available.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <PersonCard item={item} kind={kind} key={item.anilistId} />)}</div>}{error ? <div className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-4" role="alert"><p>{error}</p><button className="mt-3 min-h-11 rounded-lg border border-border px-4 font-bold" disabled={pending} onClick={() => void loadMore()} type="button">Retry</button></div> : null}{hasNextPage && error === null ? <button className="mx-auto mt-6 block min-h-11 rounded-lg border border-cyan-300 px-6 font-black text-cyan-300 disabled:opacity-50" disabled={pending} onClick={() => void loadMore()} type="button">{pending ? 'Loading…' : 'Load more'}</button> : null}{!hasNextPage && items.length > 0 ? <p className="mt-5 text-center text-sm text-muted-foreground">End of {kind}.</p> : null}</div>
}

function PersonCard({ item, kind }: { item: Person; kind: AnimePeopleKind }) {
  if (kind === 'characters') {
    const character = item as AnimeCharacter
    return <article className="flex min-h-36 overflow-hidden rounded-xl border border-border bg-card/70"><AnimeImage alt={`${character.name} portrait`} src={character.imageUrl} className="aspect-[4/5] w-2/5 shrink-0 object-cover" /><div className="flex min-w-0 flex-col justify-center p-3"><h3 className="font-black">{character.name}</h3><p className="text-sm text-cyan-300">{titleRole(character.role)}</p>{character.japaneseVoiceActor ? <div className="mt-3 flex items-center gap-2"><AnimeImage alt={`${character.japaneseVoiceActor.name} portrait`} src={character.japaneseVoiceActor.imageUrl} className="size-9 shrink-0 rounded-full object-cover" /><p className="text-xs">{character.japaneseVoiceActor.name}<br /><span className="text-muted-foreground">Japanese</span></p></div> : <p className="mt-3 text-xs text-muted-foreground">Voice actor unavailable</p>}</div></article>
  }
  const staff = item as AnimeStaff
  return <article className="flex min-h-28 overflow-hidden rounded-xl border border-border bg-card/70"><AnimeImage alt={`${staff.name} portrait`} src={staff.imageUrl} className="aspect-square w-1/3 shrink-0 object-cover" /><div className="flex min-w-0 flex-col justify-center p-3"><h3 className="font-black">{staff.name}</h3><p className="text-sm text-cyan-300">{staff.role}</p></div></article>
}

const titleRole = (role: AnimeCharacter['role']) => role.charAt(0) + role.slice(1).toLowerCase()
