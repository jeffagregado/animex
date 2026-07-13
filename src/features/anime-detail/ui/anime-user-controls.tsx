import { useEffect, useState } from 'react'
import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { ChevronDownIcon, ChevronUpIcon, HeartIcon, HistoryIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../../convex/_generated/api'
import { Dialog, DialogContent, DialogTrigger } from '#/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import type { AnimeRewatchEntry, AnimeStatus, UserAnimeEntry } from '../shared/anime-detail-contracts'
import { useAnimeAutosave, useScoreAnimeAutosave } from './use-anime-autosave'

type AnimeUserControlsProps = { anilistId: number; canonicalPath: string }
type AnimeMutation = (key: SaveKey, action: () => Promise<unknown>) => void
type ControlEntry = UserAnimeEntry | null | undefined
type SaveKey = 'favorite' | 'score' | 'status'
type SaveError = { action: () => void; message: string } | null
type ScoreAutosave = ReturnType<typeof useScoreAnimeAutosave>

const statuses: { label: string; value: AnimeStatus }[] = [
  { label: 'Watching', value: 'watching' },
  { label: 'Plan to watch', value: 'planned' },
  { label: 'Dropped', value: 'dropped' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rewatched', value: 'rewatched' },
]

/** Shows public facades until both client auth sources confirm a complete user. */
export function AnimeUserControls({ anilistId, canonicalPath }: AnimeUserControlsProps) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const complete = canQueryUserAnime(auth, convexAuth.isAuthenticated)

  if (!complete) {
    const authError = getAuthFacadeError(auth, convexAuth.isAuthenticated, convexAuth.isLoading)
    return <AuthControlFacades auth={auth} canonicalPath={canonicalPath} error={authError} />
  }

  return <CompleteAnimeUserControls anilistId={anilistId} />
}

/** Renders auth links without mounting private data hooks. */
function AuthControlFacades({ auth, canonicalPath, error }: { auth: ClientAuthState; canonicalPath: string; error: string | null }) {
  const destination = getAnimeAuthDestination(auth, canonicalPath)
  const className = 'flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-bold text-foreground hover:border-cyan-300 hover:text-cyan-300 focus-visible:border-cyan-300 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'

  if (!destination) {
    return <div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_auto]"><button className={className} disabled type="button">Status</button><button className={className} disabled type="button">Score</button><button className={className} disabled type="button">Favorite</button></div>{error ? <p className="mt-2 text-sm text-red-300" role="alert">{error} <button className="min-h-11 rounded px-2 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => window.location.reload()} type="button">Refresh authentication</button></p> : null}</div>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_auto]">
      <a className={className} href={destination}>Status</a>
      <a className={className} href={destination}>Score</a>
      <a className={className} href={destination}>Favorite</a>
    </div>
  )
}

/** Owns authenticated controls, private query, and mutations. */
function CompleteAnimeUserControls({ anilistId }: { anilistId: number }) {
  const entry = useQuery(api.userAnime.getMine, { anilistId }) as ControlEntry
  const setStatus = useMutation(api.userAnime.setStatus)
  const setScore = useMutation(api.userAnime.setScore)
  const setFavorite = useMutation(api.userAnime.setFavorite)
  const [pending, setPending] = useState<SaveKey | null>(null)
  const [error, setError] = useState<SaveError>(null)
  const loading = entry === undefined

  const mutate: AnimeMutation = (key, action) => {
    void runAnimeMutation(key, action, setPending, setError)
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_auto]">
        <StatusControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setStatus={setStatus} />
        <ScoreControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setScore={setScore} />
        <FavoriteControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setFavorite={setFavorite} />
      </div>
      <RewatchDialog anilistId={anilistId} loading={loading} />
      {error ? <p className="mt-2 text-sm text-red-300" role="alert">{error.message} <button className="min-h-11 rounded px-2 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={error.action} type="button">Retry</button></p> : null}
    </div>
  )
}

/** Autosaves status after trailing inactivity. */
function StatusControl({ anilistId, entry, loading, mutate, pending, setStatus }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setStatus: ReturnType<typeof useMutation> }) {
  const autosave = useAnimeAutosave<AnimeStatus | null>({
    delayMs: 500,
    isValid: (value) => value !== null,
    persist: (action) => mutate('status', action),
    save: async (value) => {
      if (value === null) throw new Error('Status is required.')
      await setStatus({ anilistId, status: value })
    },
    serverValue: entry?.status ?? null,
  })

  return (
    <label className="block text-sm text-muted-foreground">
      Status
      <Select disabled={loading || pending !== null} onValueChange={(value, details) => { if (value) { autosave.schedule(value as AnimeStatus); if (isKeyboardEnter(details.event)) autosave.flush(value as AnimeStatus) } }} value={autosave.value}>
        <SelectTrigger aria-label="Status" className="mt-1 min-h-11" disabled={loading || pending !== null} onBlur={() => { if (autosave.value) autosave.flush(autosave.value) }}>
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {statuses.map((option) => <SelectItem key={option.value} onClick={() => autosave.schedule(option.value)} value={option.value}>{option.label}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  )
}

/** Autosaves valid half-step scores and flushes committed values. */
function ScoreControl({ anilistId, entry, loading, mutate, pending, setScore }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setScore: ReturnType<typeof useMutation> }) {
  const autosave = useScoreAnimeAutosave({
    delayMs: 500,
    persist: (action) => mutate('score', action),
    save: async (value) => await setScore({ anilistId, score: value }),
    serverValue: entry?.score ?? null,
  })
  const disabled = loading || pending !== null

  return (
    <div>
      <span className="text-sm text-muted-foreground">Score</span>
      <ScoreNumberField autosave={autosave} disabled={disabled} />
      <ScoreValidationError message={autosave.error} />
      <ScoreClear autosave={autosave} disabled={disabled} />
    </div>
  )
}

/** Renders the bounded half-step field. */
function ScoreNumberField({ autosave, disabled }: { autosave: ScoreAutosave; disabled: boolean }) {
  return <NumberFieldPrimitive.Root disabled={disabled} max={10} min={0} onValueChange={autosave.schedule} step={0.5} value={autosave.value}><NumberFieldPrimitive.Group className="mt-1 flex min-h-11 overflow-hidden rounded-lg border border-border bg-card focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-300/40"><NumberFieldPrimitive.Decrement aria-label="Decrease score" className="grid w-11 place-items-center border-r border-border text-muted-foreground hover:bg-white/5 hover:text-cyan-300 focus-visible:bg-cyan-300/10 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" disabled={disabled}><ChevronDownIcon className="size-4" /></NumberFieldPrimitive.Decrement><NumberFieldPrimitive.Input aria-describedby={autosave.error ? 'anime-score-error' : undefined} aria-invalid={Boolean(autosave.error)} aria-label="Score" className="min-w-0 flex-1 bg-transparent px-3 text-center outline-none" max={10} min={0} onBlur={autosave.commit} onKeyDown={(event) => { if (event.key === 'Enter') autosave.commit() }} step={0.5} /><NumberFieldPrimitive.Increment aria-label="Increase score" className="grid w-11 place-items-center border-l border-border text-muted-foreground hover:bg-white/5 hover:text-cyan-300 focus-visible:bg-cyan-300/10 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" disabled={disabled}><ChevronUpIcon className="size-4" /></NumberFieldPrimitive.Increment></NumberFieldPrimitive.Group></NumberFieldPrimitive.Root>
}

/** Announces direct-entry validation errors. */
function ScoreValidationError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-300" id="anime-score-error" role="alert">{message}</p>
}

/** Clears a saved or drafted score. */
function ScoreClear({ autosave, disabled }: { autosave: ScoreAutosave; disabled: boolean }) {
  if (autosave.value === null) return null
  return <button aria-label="Clear score" className="mt-1 flex min-h-11 items-center text-xs font-bold text-muted-foreground hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={disabled} onClick={autosave.clear} type="button">Clear</button>
}

/** Persists favorite changes immediately. */
function FavoriteControl({ anilistId, entry, loading, mutate, pending, setFavorite }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setFavorite: ReturnType<typeof useMutation> }) {
  const favorite = entry?.isFavorite ?? false

  return <button aria-pressed={favorite} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 font-bold hover:border-cyan-300 hover:text-cyan-300 focus-visible:border-cyan-300 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={loading || pending !== null} onClick={() => mutate('favorite', async () => await setFavorite({ anilistId, isFavorite: !favorite }))} type="button"><HeartIcon className={`size-5 ${favorite ? 'fill-coral-400 text-coral-400' : ''}`} />Favorite</button>
}

/** Runs one mutation and exposes its exact action for retry. */
async function runAnimeMutation(key: SaveKey, action: () => Promise<unknown>, setPending: (value: SaveKey | null) => void, setError: (value: SaveError) => void): Promise<void> {
  setPending(key)
  setError(null)

  try {
    await action()
    toast.success(`${key[0].toUpperCase()}${key.slice(1)} saved.`)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Anime control failed.'
    const retry = (): void => { void runAnimeMutation(key, action, setPending, setError) }
    setError({ action: retry, message })
    toast.error(message, { action: { label: 'Retry', onClick: retry } })
  } finally {
    setPending(null)
  }
}

/** Identifies an Enter commit from a portaled Base UI option. */
function isKeyboardEnter(event: Event): boolean {
  return event instanceof KeyboardEvent && event.key === 'Enter'
}

function RewatchDialog({ anilistId, loading }: { anilistId: number; loading: boolean }) {
  const [open, setOpen] = useState(false)
  return <Dialog onOpenChange={setOpen} open={open}><DialogTrigger className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 font-bold hover:border-cyan-300 hover:text-cyan-300 focus-visible:border-cyan-300 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={loading}><HistoryIcon className="size-5" />Rewatch history</DialogTrigger>{open ? <DialogContent title="Rewatch history"><RewatchHistory anilistId={anilistId} /></DialogContent> : null}</Dialog>
}

function RewatchHistory({ anilistId }: { anilistId: number }) {
  const [cursor, setCursor] = useState<string | null>(null)
  const [items, setItems] = useState<AnimeRewatchEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const history = useQuery(api.userAnime.listMyRewatches, { anilistId, paginationOpts: { cursor, numItems: 20 } })
  const record = useMutation(api.userAnime.recordRewatch)
  const remove = useMutation(api.userAnime.removeLatestRewatch)

  useEffect(() => { if (history) setItems((current) => reconcileRewatchItems(current, history.items, cursor)) }, [cursor, history])

  const change = async (action: () => Promise<unknown>): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      await action()
      setItems([])
      setCursor(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rewatch update failed.')
    } finally {
      setPending(false)
    }
  }

  return <div className="mt-5"><div className="flex gap-2"><button className="min-h-11 rounded-lg bg-cyan-300 px-4 font-black text-primary-foreground" disabled={pending} onClick={() => void change(async () => await record({ anilistId }))} type="button">Record rewatch</button><button className="min-h-11 rounded-lg border border-border px-4 font-bold" disabled={pending || items.length === 0} onClick={() => void change(async () => await remove({ anilistId }))} type="button">Remove latest</button></div>{error ? <p className="mt-3 text-red-300" role="alert">{error}</p> : null}<ol className="mt-4 space-y-2">{items.map((item) => <li className="rounded-lg border border-border p-3" key={item.id}>{new Date(item.completedAt).toLocaleDateString()}</li>)}</ol>{history && !history.isDone ? <button className="mt-4 min-h-11 rounded-lg border border-border px-4" onClick={() => setCursor(history.continueCursor)} type="button">Load more history</button> : null}</div>
}

/** Resolves auth action without sending loading or complete users to a wrong step. */
export const getAnimeAuthDestination = (auth: ClientAuthState, returnTo: string): string | null => {
  const encoded = encodeURIComponent(returnTo)
  if (auth.status !== 'ready') return null
  if (auth.authState.status === 'signedOut') return `/auth/sign-in?returnTo=${encoded}`
  if (auth.authState.status === 'emailUnverified') return `/auth/verify-email?returnTo=${encoded}`
  if (auth.authState.status === 'needsProfile') return `/auth/username?returnTo=${encoded}`
  return null
}

/** Allows private Convex calls only after both auth sources agree. */
export const canQueryUserAnime = (auth: ClientAuthState, isConvexAuthenticated: boolean): boolean => auth.status === 'ready' && auth.authState.status === 'complete' && isConvexAuthenticated

/** Explains settled auth failures without mounting private hooks. */
const getAuthFacadeError = (auth: ClientAuthState, isConvexAuthenticated: boolean, isConvexLoading: boolean): string | null => {
  if (auth.status === 'error') return auth.message
  if (auth.status === 'ready' && auth.authState.status === 'complete' && !isConvexLoading && !isConvexAuthenticated) return 'Authentication is unavailable. Refresh the page or sign in again.'
  return null
}

/** Replaces first page after mutations and appends later pages without duplicates. */
export const reconcileRewatchItems = (current: AnimeRewatchEntry[], page: AnimeRewatchEntry[], cursor: string | null): AnimeRewatchEntry[] => cursor === null ? page : [...current, ...page.filter((item) => !current.some((entry) => entry.id === item.id))]
