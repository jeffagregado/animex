import { useState, type ReactNode } from 'react'
import { useConvexAuth } from 'convex/react'
import { PenLineIcon } from 'lucide-react'

import { usePublicAuthState } from '../shell/public-auth-context'
import type { FeedCard } from '../social/shared/social-contracts'
import { FeedList } from './feed-list'
import { PostComposerDialog } from './post-composer-dialog'
import { type FeedView, useFeedPages } from './use-feed-pages'

export interface HomeFeedSearch { feed: FeedView; compose: boolean }

/** Orchestrates public/private Home feeds and shared Post composer URL state. */
export function FeedPage({ search, onSearchChange, sidebar }: { search: HomeFeedSearch; onSearchChange: (next: HomeFeedSearch) => void; sidebar: ReactNode }) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const profile = auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile : null
  const signedIn = profile !== null && convexAuth.isAuthenticated
  const view = signedIn ? search.feed : 'global'
  const pages = useFeedPages(view, signedIn ? profile.id : 'public')
  const [edit, setEdit] = useState<Extract<FeedCard, { kind: 'post' }> | null>(null)
  const ownerId = signedIn ? profile.id : null
  const visibility = signedIn ? profile.visibility : 'public'
  const composerOpen = signedIn && (search.compose || edit !== null)
  const closeComposer = (): void => { setEdit(null); if (search.compose) onSearchChange({ ...search, compose: false }) }
  const saved = (): void => { closeComposer(); void pages.refresh() }
  return <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-4 sm:px-6 lg:px-10 lg:pb-8"><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px]"><section className="min-w-0 space-y-4"><div className="flex items-end justify-between gap-3 border-b border-white/8"><div className="flex min-w-0 gap-2 sm:gap-7" role="tablist" aria-label="Feed view">{signedIn ? (['home', 'global'] as FeedView[]).map((item) => <button aria-selected={view === item} className={`min-h-12 border-b-2 px-2 font-bold capitalize transition hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300 ${view === item ? 'border-cyan-300 text-cyan-300' : 'border-transparent text-muted-foreground'}`} key={item} onClick={() => onSearchChange({ feed: item, compose: false })} role="tab" type="button">{item}</button>) : <h1 className="pb-3 text-xl font-black">Global</h1>}</div>{signedIn ? <button className="mb-2 flex min-h-11 items-center gap-2 rounded-lg bg-coral-400 px-4 font-black text-slate-950 hover:bg-coral-300 focus-visible:ring-2 focus-visible:ring-coral-200" onClick={() => onSearchChange({ ...search, compose: true })} type="button"><PenLineIcon className="size-4" />Create Post</button> : null}</div><FeedList {...pages} cards={pages.items} loadMore={() => void pages.loadMore()} onChanged={() => void pages.refresh()} onEdit={setEdit} retry={() => void pages.retry()} ownerId={ownerId} view={view} /></section>{sidebar}</div><PostComposerDialog edit={edit} initialVisibility={visibility} onClose={closeComposer} onSaved={saved} open={composerOpen} /></main>
}
