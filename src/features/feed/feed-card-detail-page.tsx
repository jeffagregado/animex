import { useState } from 'react'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { isCompleteAuthState } from '../auth/use-auth-state'
import { usePublicAuthState } from '../shell/public-auth-context'
import { feedCardSchema } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'
import { PostComposerDialog } from './post-composer-dialog'

/** Loads one visibility-filtered feed card for direct linking. */
export function FeedCardDetailPage({ cardId }: { cardId: string }) {
  const [editOpen, setEditOpen] = useState(false)
  const raw = useQuery(api.feed.getById, { cardId: cardId as Id<'feedCards'> })
  const auth = usePublicAuthState()
  const signedIn = auth.status === 'ready' && isCompleteAuthState(auth.authState)
  const ownerId = auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile.id : null
  if (raw === undefined) return <DetailState title="Loading activity…" message="Fetching latest activity." />
  if (raw === null) return <DetailState title="Activity not found" message="This activity is missing, private, or unavailable." />
  const card = feedCardSchema.parse(raw)
  const edit = editOpen && card.kind === 'post' ? card : null
  const visibility = auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile.visibility : 'public'
  return <main className="mx-auto min-h-[55dvh] max-w-3xl px-4 py-8"><a className="mb-5 inline-block font-bold text-cyan-300 hover:underline" href="/home">← Back to feed</a><FeedCard card={card} onChanged={() => undefined} onEdit={() => setEditOpen(true)} owner={ownerId === card.author.id} signedIn={signedIn} /><PostComposerDialog edit={edit} initialVisibility={visibility} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} open={edit !== null} /></main>
}

function DetailState({ title, message }: { title: string; message: string }) { return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p><a className="mt-5 inline-block min-h-11 rounded-lg border border-cyan-300/40 px-5 py-3 font-bold text-cyan-200" href="/home">Return Home</a></div></main> }
