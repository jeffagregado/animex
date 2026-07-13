import { Component, useState, type ReactNode } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { isCompleteAuthState } from '../auth/use-auth-state'
import { usePublicAuthState } from '../shell/public-auth-context'
import { feedCardSchema } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'
import { PostComposerDialog } from './post-composer-dialog'

/** Isolates malformed IDs, query failures, and strict parse failures. */
export function FeedCardDetailPage({ cardId }: { cardId: string }) {
  return <FeedDetailBoundary cardId={cardId}><FeedCardDetailContent cardId={cardId} /></FeedDetailBoundary>
}

function FeedCardDetailContent({ cardId }: { cardId: string }) {
  const [editOpen, setEditOpen] = useState(false)
  const raw = useQuery(api.feed.getById, { cardId })
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const signedIn = auth.status === 'ready' && isCompleteAuthState(auth.authState) && convexAuth.isAuthenticated
  const ownerId = signedIn && auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile.id : null
  if (raw === undefined) return <DetailState title="Loading activity…" message="Fetching latest activity." />
  if (raw === null) return <DetailState title="Activity not found" message="This activity is missing, private, malformed, or unavailable." />
  const card = feedCardSchema.parse(raw)
  const edit = editOpen && card.kind === 'post' ? card : null
  const visibility = signedIn && auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile.visibility : 'public'
  return <main className="mx-auto min-h-[55dvh] max-w-3xl px-4 py-8"><a className="mb-5 inline-block font-bold text-cyan-300 hover:underline" href="/home">← Back to feed</a><FeedCard card={card} onChanged={() => undefined} onEdit={() => setEditOpen(true)} owner={ownerId === card.author.id} signedIn={signedIn} /><PostComposerDialog edit={edit} initialVisibility={visibility} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} open={edit !== null} /></main>
}

class FeedDetailBoundary extends Component<{ cardId: string; children: ReactNode }, { error: Error | null; retry: number }> {
  state = { error: null, retry: 0 } as { error: Error | null; retry: number }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidUpdate(previous: { cardId: string }) { if (previous.cardId !== this.props.cardId && this.state.error) this.setState({ error: null, retry: this.state.retry + 1 }) }
  render() { return this.state.error ? <DetailState title="Activity unavailable" message={this.state.error.message} action={() => this.setState(({ retry }) => ({ error: null, retry: retry + 1 }))} /> : <div key={this.state.retry}>{this.props.children}</div> }
}

function DetailState({ title, message, action }: { title: string; message: string; action?: () => void }) { return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground" role={action ? 'alert' : undefined}>{message}</p>{action ? <button className="mt-5 min-h-11 rounded-lg border border-cyan-300/40 px-5 font-bold text-cyan-200" onClick={action} type="button">Retry</button> : <a className="mt-5 inline-block min-h-11 rounded-lg border border-cyan-300/40 px-5 py-3 font-bold text-cyan-200" href="/home">Return Home</a>}</div></main> }
