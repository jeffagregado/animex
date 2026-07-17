import { useState } from 'react'

import { getAnimePeoplePage } from '../server/anime-detail.functions'
import type { AnimeCharacter, AnimePeopleKind, AnimePeoplePage, AnimeStaff } from '../shared/anime-detail-contracts'
import { createCatalogPersonPath } from '#/features/catalog-person/shared/catalog-person-contracts'
import { AnimeImage } from './anime-image'

type Person = AnimeCharacter | AnimeStaff
type AnimePeopleGridProps = { anilistId: number; initialPage: AnimePeoplePage<Person>; kind: AnimePeopleKind }

/** Appends deduplicated people pages while keeping successful cards on failure. */
export function AnimePeopleGrid({ anilistId, initialPage, kind }: AnimePeopleGridProps) {
  const [items, setItems] = useState<Person[]>(() => uniquePeople(initialPage.items))
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
      setItems((current) => uniquePeople([...current, ...next.items]))
      setPage(next.currentPage); setHasNextPage(next.hasNextPage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'People page request failed.')
    } finally { setPending(false) }
  }

  return <div>{kind === 'staff' ? <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-cyan-300">Primary Production</h2> : null}{items.length === 0 ? <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No {kind} available.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <PersonCard item={item} kind={kind} key={item.anilistId} />)}</div>}{error ? <div className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-4" role="alert"><p>{error}</p><button className="mt-3 min-h-11 rounded-lg border border-border px-4 font-bold" disabled={pending} onClick={() => void loadMore()} type="button">Retry</button></div> : null}{hasNextPage && error === null ? <button className="mx-auto mt-6 block min-h-11 rounded-lg border border-cyan-300 px-6 font-black text-cyan-300 disabled:opacity-50" disabled={pending} onClick={() => void loadMore()} type="button">{pending ? 'Loading…' : 'Load more'}</button> : null}{!hasNextPage && items.length > 0 ? <p className="mt-5 text-center text-sm text-muted-foreground">End of {kind}.</p> : null}</div>
}

/** Keeps first provider occurrence for each AniList person ID. */
function uniquePeople(items: Person[]): Person[] {
  const ids = new Set<number>()
  return items.filter((item) => {
    if (ids.has(item.anilistId)) return false
    ids.add(item.anilistId)
    return true
  })
}

function PersonCard({ item, kind }: { item: Person; kind: AnimePeopleKind }) {
  if (kind === 'characters') {
    const character = item as AnimeCharacter
    const path = createCatalogPersonPath('character', character.anilistId, character.name)
    return <article className="flex min-h-36 overflow-hidden rounded-xl border border-border bg-card/70">
      <a className="w-2/5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" href={path}><AnimeImage alt={`${character.name} portrait`} src={character.imageUrl} className="aspect-[4/5] size-full object-cover" /></a>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3"><a className="flex min-h-11 items-center rounded-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={path}><h3>{character.name}</h3></a><p className="text-sm text-cyan-300">{titleRole(character.role)}</p>{character.japaneseVoiceActor ? <VoiceActorIdentity voiceActor={character.japaneseVoiceActor} /> : <p className="mt-3 text-xs text-muted-foreground">Voice actor unavailable</p>}</div>
    </article>
  }
  const staff = item as AnimeStaff
  const path = createCatalogPersonPath('staff', staff.anilistId, staff.name)
  return <article className="flex min-h-28 overflow-hidden rounded-xl border border-border bg-card/70">
    <a className="w-1/3 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" href={path}><AnimeImage alt={`${staff.name} portrait`} src={staff.imageUrl} className="aspect-square size-full object-cover" /></a>
    <div className="flex min-w-0 flex-1 flex-col justify-center p-3"><a className="flex min-h-11 items-center rounded-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={path}><h3>{staff.name}</h3></a><p className="text-sm text-cyan-300">{staff.role}</p></div>
  </article>
}

function VoiceActorIdentity({ voiceActor }: { voiceActor: NonNullable<AnimeCharacter['japaneseVoiceActor']> }) {
  const path = createCatalogPersonPath('staff', voiceActor.anilistId, voiceActor.name)
  return <div className="mt-3"><a className="flex min-h-11 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={path}><AnimeImage alt={`${voiceActor.name} portrait`} src={voiceActor.imageUrl} className="size-9 shrink-0 rounded-full object-cover" /><span className="text-xs">{voiceActor.name}</span></a><span className="block text-xs text-muted-foreground">Japanese</span></div>
}

const titleRole = (role: AnimeCharacter['role']) => role.charAt(0) + role.slice(1).toLowerCase()
