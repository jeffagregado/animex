import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { HeartIcon, HistoryIcon } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { Dialog, DialogContent, DialogTrigger } from '#/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import type { AnimeRewatchEntry, AnimeStatus, UserAnimeEntry } from '../shared/anime-detail-contracts'

type AnimeUserControlsProps = { anilistId: number; canonicalPath: string }
type AnimeMutation = (key: string, action: () => Promise<unknown>) => void
type ControlEntry = UserAnimeEntry | null | undefined
const statuses: { label: string; value: AnimeStatus }[] = [{ label: 'Watching', value: 'watching' }, { label: 'Plan to watch', value: 'planned' }, { label: 'Dropped', value: 'dropped' }, { label: 'Completed', value: 'completed' }, { label: 'Rewatched', value: 'rewatched' }]

/** Exposes public controls while protecting private Convex calls behind complete auth. */
export function AnimeUserControls({ anilistId, canonicalPath }: AnimeUserControlsProps) {
  const controls = useAnimeUserControls(anilistId, canonicalPath)
  return <div><div className="grid gap-3 rounded-xl border border-border bg-card/75 p-4 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_auto]">
    <StatusControl anilistId={anilistId} authPending={controls.authPending} complete={controls.complete} entry={controls.entry} gate={controls.gate} mutate={controls.mutate} pending={controls.pending} setStatus={controls.setStatus} />
    <ScoreControl anilistId={anilistId} entry={controls.entry} mutate={controls.mutate} pending={controls.pending} setError={controls.setError} setScore={controls.setScore} />
    <FavoriteControl anilistId={anilistId} authPending={controls.authPending} entry={controls.entry} mutate={controls.mutate} pending={controls.pending} setFavorite={controls.setFavorite} />
  </div>{controls.complete ? <RewatchDialog anilistId={anilistId} /> : null}{controls.error ? <p className="mt-2 text-sm text-red-300" role="alert">{controls.error}</p> : null}</div>
}

function useAnimeUserControls(anilistId: number, canonicalPath: string) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const complete = canQueryUserAnime(auth, convexAuth.isAuthenticated)
  const authPending = auth.status === 'loading' || convexAuth.isLoading
  const entry = useQuery(api.userAnime.getMine, complete ? { anilistId } : 'skip') as UserAnimeEntry | null | undefined
  const setStatus = useMutation(api.userAnime.setStatus)
  const setScore = useMutation(api.userAnime.setScore)
  const setFavorite = useMutation(api.userAnime.setFavorite)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gate = (): boolean => gateAnimeControl(auth, complete, authPending, canonicalPath, setError)
  const mutate: AnimeMutation = (key, action) => void runAnimeMutation(key, action, gate, setPending, setError)
  return { authPending, complete, entry, error, gate, mutate, pending, setError, setFavorite, setScore, setStatus }
}

function StatusControl({ anilistId, authPending, complete, entry, gate, mutate, pending, setStatus }: { anilistId: number; authPending: boolean; complete: boolean; entry: ControlEntry; gate: () => boolean; mutate: AnimeMutation; pending: string | null; setStatus: ReturnType<typeof useMutation> }) {
  const changeStatus = (value: string | null): void => {
    if (!value) return
    mutate('status', async () => await setStatus({ anilistId, status: value as AnimeStatus }))
  }
  return <label className="block text-sm text-muted-foreground">Status<Select value={entry?.status ?? null} onValueChange={changeStatus} disabled={pending !== null || authPending} onOpenChange={(open) => { if (open && !complete) gate() }}><SelectTrigger className="mt-1 min-h-11"><SelectValue placeholder="Set status" /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></label>
}

function ScoreControl({ anilistId, entry, mutate, pending, setError, setScore }: { anilistId: number; entry: ControlEntry; mutate: AnimeMutation; pending: string | null; setError: Dispatch<SetStateAction<string | null>>; setScore: ReturnType<typeof useMutation> }) {
  const [score, setScoreInput] = useState('')
  const saveScore = (): void => {
    const parsed = Number(score)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
      setError('Score must be between 0 and 10.')
      return
    }
    mutate('score', async () => await setScore({ anilistId, score: parsed }))
  }
  return <form onSubmit={(event) => { event.preventDefault(); saveScore() }}><label className="text-sm text-muted-foreground" htmlFor="anime-score">Score</label><div className="mt-1 flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3" id="anime-score" max="10" min="0" onChange={(event) => setScoreInput(event.target.value)} placeholder={entry?.score?.toString() ?? '0–10'} step="0.1" type="number" value={score} /><button className="min-h-11 rounded-lg border border-border px-3 font-bold" disabled={pending !== null} type="submit">Save</button>{entry?.score !== null && entry?.score !== undefined ? <button aria-label="Clear score" className="min-h-11 px-2 text-muted-foreground" onClick={() => mutate('score', async () => await setScore({ anilistId, score: null }))} type="button">Clear</button> : null}</div></form>
}

function FavoriteControl({ anilistId, authPending, entry, mutate, pending, setFavorite }: { anilistId: number; authPending: boolean; entry: ControlEntry; mutate: AnimeMutation; pending: string | null; setFavorite: ReturnType<typeof useMutation> }) {
  return <button aria-pressed={entry?.isFavorite ?? false} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 font-bold hover:border-cyan-300" disabled={pending !== null || authPending} onClick={() => mutate('favorite', async () => await setFavorite({ anilistId, isFavorite: !(entry?.isFavorite ?? false) }))} type="button"><HeartIcon className={`size-5 ${entry?.isFavorite ? 'fill-coral-400 text-coral-400' : ''}`} />Favorite</button>
}

function gateAnimeControl(auth: ClientAuthState, complete: boolean, authPending: boolean, canonicalPath: string, setError: Dispatch<SetStateAction<string | null>>): boolean {
  if (complete) return true
  const destination = getAnimeAuthDestination(auth, canonicalPath)
  if (destination) window.location.assign(destination)
  else if (!authPending) setError('Authenticated session is not ready. Refresh and try again.')
  return false
}

async function runAnimeMutation(key: string, action: () => Promise<unknown>, gate: () => boolean, setPending: Dispatch<SetStateAction<string | null>>, setError: Dispatch<SetStateAction<string | null>>): Promise<void> {
  if (!gate()) return
  setPending(key)
  setError(null)
  try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anime control failed.') } finally { setPending(null) }
}

function RewatchDialog({ anilistId }: { anilistId: number }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 font-bold"><HistoryIcon className="size-5" />Rewatch history</DialogTrigger>{open ? <DialogContent title="Rewatch history"><RewatchHistory anilistId={anilistId} /></DialogContent> : null}</Dialog>
}

function RewatchHistory({ anilistId }: { anilistId: number }) {
  const [cursor, setCursor] = useState<string | null>(null); const [items, setItems] = useState<AnimeRewatchEntry[]>([])
  const history = useQuery(api.userAnime.listMyRewatches, { anilistId, paginationOpts: { cursor, numItems: 20 } })
  const record = useMutation(api.userAnime.recordRewatch); const remove = useMutation(api.userAnime.removeLatestRewatch); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false)
  useEffect(() => { if (history) setItems((current) => reconcileRewatchItems(current, history.items, cursor)) }, [cursor, history])
  const change = async (action: () => Promise<unknown>) => { setPending(true); setError(null); try { await action(); setItems([]); setCursor(null) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rewatch update failed.') } finally { setPending(false) } }
  return <div className="mt-5"><div className="flex gap-2"><button className="min-h-11 rounded-lg bg-cyan-300 px-4 font-black text-primary-foreground" disabled={pending} onClick={() => void change(async () => await record({ anilistId }))} type="button">Record rewatch</button><button className="min-h-11 rounded-lg border border-border px-4 font-bold" disabled={pending || items.length === 0} onClick={() => void change(async () => await remove({ anilistId }))} type="button">Remove latest</button></div>{error ? <p className="mt-3 text-red-300" role="alert">{error}</p> : null}<ol className="mt-4 space-y-2">{items.map((item) => <li className="rounded-lg border border-border p-3" key={item.id}>{new Date(item.completedAt).toLocaleDateString()}</li>)}</ol>{history && !history.isDone ? <button className="mt-4 min-h-11 rounded-lg border border-border px-4" onClick={() => setCursor(history.continueCursor)} type="button">Load more history</button> : null}</div>
}

/** Resolves auth action without sending loading or complete users to a wrong step. */
export const getAnimeAuthDestination = (auth: ClientAuthState, returnTo: string): string | null => { const encoded = encodeURIComponent(returnTo); if (auth.status !== 'ready') return null; if (auth.authState.status === 'signedOut') return `/auth/sign-in?returnTo=${encoded}`; if (auth.authState.status === 'emailUnverified') return `/auth/verify-email?returnTo=${encoded}`; if (auth.authState.status === 'needsProfile') return `/auth/username?returnTo=${encoded}`; return null }

/** Allows private Convex calls only after both auth sources agree. */
export const canQueryUserAnime = (auth: ClientAuthState, isConvexAuthenticated: boolean): boolean => auth.status === 'ready' && auth.authState.status === 'complete' && isConvexAuthenticated

/** Replaces first page after mutations and appends later pages without duplicates. */
export const reconcileRewatchItems = (current: AnimeRewatchEntry[], page: AnimeRewatchEntry[], cursor: string | null): AnimeRewatchEntry[] => cursor === null ? page : [...current, ...page.filter((item) => !current.some((entry) => entry.id === item.id))]
