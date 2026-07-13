import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { HeartIcon, HistoryIcon } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { Dialog, DialogContent, DialogTrigger } from '#/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import type { AnimeStatus, UserAnimeEntry } from '../shared/anime-detail-contracts'

type AnimeUserControlsProps = { anilistId: number; canonicalPath: string }
const statuses: { label: string; value: AnimeStatus }[] = [{ label: 'Watching', value: 'watching' }, { label: 'Plan to watch', value: 'planned' }, { label: 'Dropped', value: 'dropped' }, { label: 'Completed', value: 'completed' }, { label: 'Rewatched', value: 'rewatched' }]

/** Exposes public controls while protecting private Convex calls behind complete auth. */
export function AnimeUserControls({ anilistId, canonicalPath }: AnimeUserControlsProps) {
  const auth = usePublicAuthState()
  const complete = auth.status === 'ready' && auth.authState.status === 'complete'
  const entry = useQuery(api.userAnime.getMine, complete ? { anilistId } : 'skip') as UserAnimeEntry | null | undefined
  const setStatus = useMutation(api.userAnime.setStatus); const setScore = useMutation(api.userAnime.setScore); const setFavorite = useMutation(api.userAnime.setFavorite)
  const [score, setScoreInput] = useState(''); const [pending, setPending] = useState<string | null>(null); const [error, setError] = useState<string | null>(null)
  const gate = (): boolean => { if (complete) return true; window.location.assign(authPath(auth, canonicalPath)); return false }
  const mutate = async (key: string, action: () => Promise<unknown>): Promise<void> => { if (!gate()) return; setPending(key); setError(null); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anime control failed.') } finally { setPending(null) } }
  return <div><div className="grid gap-3 rounded-xl border border-border bg-card/75 p-4 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_auto]">
    <label className="block text-sm text-muted-foreground">Status<Select value={entry?.status ?? null} onValueChange={(value) => value ? void mutate('status', async () => await setStatus({ anilistId, status: value as AnimeStatus })) : undefined} disabled={pending !== null} onOpenChange={(open) => { if (open && !complete) gate() }}><SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder="Set status" /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></label>
    <form onSubmit={(event) => { event.preventDefault(); const parsed = Number(score); if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) { setError('Score must be between 0 and 10.'); return } void mutate('score', async () => await setScore({ anilistId, score: parsed })) }}><label className="text-sm text-muted-foreground" htmlFor="anime-score">Score</label><div className="mt-1 flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3" id="anime-score" max="10" min="0" onChange={(event) => setScoreInput(event.target.value)} placeholder={entry?.score?.toString() ?? '0–10'} step="0.1" type="number" value={score} /><button className="min-h-11 rounded-lg border border-border px-3 font-bold" disabled={pending !== null} type="submit">Save</button>{entry?.score !== null && entry?.score !== undefined ? <button aria-label="Clear score" className="min-h-11 px-2 text-muted-foreground" onClick={() => void mutate('score', async () => await setScore({ anilistId, score: null }))} type="button">Clear</button> : null}</div></form>
    <button aria-pressed={entry?.isFavorite ?? false} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 font-bold hover:border-cyan-300" disabled={pending !== null} onClick={() => void mutate('favorite', async () => await setFavorite({ anilistId, isFavorite: !(entry?.isFavorite ?? false) }))} type="button"><HeartIcon className={`size-5 ${entry?.isFavorite ? 'fill-coral-400 text-coral-400' : ''}`} />Favorite</button>
  </div>{complete ? <RewatchDialog anilistId={anilistId} /> : null}{error ? <p className="mt-2 text-sm text-red-300" role="alert">{error}</p> : null}</div>
}

function RewatchDialog({ anilistId }: { anilistId: number }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 font-bold"><HistoryIcon className="size-5" />Rewatch history</DialogTrigger>{open ? <DialogContent title="Rewatch history"><RewatchHistory anilistId={anilistId} /></DialogContent> : null}</Dialog>
}

function RewatchHistory({ anilistId }: { anilistId: number }) {
  const [cursor, setCursor] = useState<string | null>(null); const [items, setItems] = useState<{ id: string; completedAt: number }[]>([])
  const history = useQuery(api.userAnime.listMyRewatches, { anilistId, paginationOpts: { cursor, numItems: 20 } })
  const record = useMutation(api.userAnime.recordRewatch); const remove = useMutation(api.userAnime.removeLatestRewatch); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false)
  useEffect(() => { if (history) setItems((current) => [...current, ...history.items.filter((item) => !current.some((entry) => entry.id === item.id))]) }, [history])
  const change = async (action: () => Promise<unknown>) => { setPending(true); setError(null); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rewatch update failed.') } finally { setPending(false) } }
  return <div className="mt-5"><div className="flex gap-2"><button className="min-h-11 rounded-lg bg-cyan-300 px-4 font-black text-primary-foreground" disabled={pending} onClick={() => void change(async () => await record({ anilistId }))} type="button">Record rewatch</button><button className="min-h-11 rounded-lg border border-border px-4 font-bold" disabled={pending || items.length === 0} onClick={() => void change(async () => await remove({ anilistId }))} type="button">Remove latest</button></div>{error ? <p className="mt-3 text-red-300" role="alert">{error}</p> : null}<ol className="mt-4 space-y-2">{items.map((item) => <li className="rounded-lg border border-border p-3" key={item.id}>{new Date(item.completedAt).toLocaleDateString()}</li>)}</ol>{history && !history.isDone ? <button className="mt-4 min-h-11 rounded-lg border border-border px-4" onClick={() => setCursor(history.continueCursor)} type="button">Load more history</button> : null}</div>
}

const authPath = (auth: ReturnType<typeof usePublicAuthState>, returnTo: string): string => { const encoded = encodeURIComponent(returnTo); if (auth.status !== 'ready' || auth.authState.status === 'signedOut') return `/auth/sign-in?returnTo=${encoded}`; if (auth.authState.status === 'emailUnverified') return `/auth/verify-email?returnTo=${encoded}`; return `/auth/username?returnTo=${encoded}` }
