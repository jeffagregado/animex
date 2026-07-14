import { useEffect, useState } from 'react'
import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { ChevronDownIcon, ChevronUpIcon, HeartIcon, HistoryIcon, StarIcon } from 'lucide-react'
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
type AuthFacadeKind = 'favorite' | 'score' | 'status'
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

const controlShellClass = 'min-h-14 rounded-lg border border-border bg-card px-3 py-2 transition hover:border-cyan-300 hover:bg-cyan-300/5 focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-300/40'
const autosaveDelayMs = 750

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
  const className = 'min-h-14 rounded-lg border border-border bg-card px-3 py-2 text-foreground transition hover:border-cyan-300 hover:bg-cyan-300/5 focus-visible:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50'

  if (!destination) {
    return <div><div className="grid gap-3 sm:grid-cols-3"><button aria-label="Status" className={className} disabled type="button"><AuthFacadeContent kind="status" /></button><button aria-label="Score" className={className} disabled type="button"><AuthFacadeContent kind="score" /></button><button aria-label="Favorite" className={className} disabled type="button"><AuthFacadeContent kind="favorite" /></button></div>{error ? <p className="mt-2 text-sm text-red-300" role="alert">{error} <button className="min-h-11 rounded px-2 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => window.location.reload()} type="button">Refresh authentication</button></p> : null}</div>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <a aria-label="Status" className={className} href={destination}><AuthFacadeContent kind="status" /></a>
      <a aria-label="Score" className={className} href={destination}><AuthFacadeContent kind="score" /></a>
      <a aria-label="Favorite" className={className} href={destination}><AuthFacadeContent kind="favorite" /></a>
    </div>
  )
}

/** Mirrors private control styling without mounting private inputs. */
function AuthFacadeContent({ kind }: { kind: AuthFacadeKind }) {
  if (kind === 'favorite') return <span className="flex h-full items-center justify-center gap-2 font-bold"><HeartIcon className="size-5" />Favorite</span>
  if (kind === 'score') return <span className="block text-left"><span className="block text-xs text-muted-foreground">Score</span><span className="mt-0.5 flex h-6 items-center text-base font-semibold"><StarIcon className="mr-2 size-4 fill-amber-300 text-amber-300" />0<span aria-hidden="true" className="ml-auto flex flex-col text-muted-foreground"><ChevronUpIcon className="size-3.5" /><ChevronDownIcon className="size-3.5" /></span></span></span>
  return <span className="block text-left"><span className="block text-xs text-muted-foreground">Status</span><span className="mt-0.5 flex h-6 items-center gap-2 text-base font-semibold"><span aria-hidden="true" className="size-2.5 rounded-full bg-muted-foreground/50" />Set status<ChevronDownIcon aria-hidden="true" className="ml-auto size-4 text-cyan-300" /></span></span>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.15fr_1.15fr_auto_auto]">
        <StatusControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setStatus={setStatus} />
        <ScoreControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setScore={setScore} />
        <FavoriteControl anilistId={anilistId} entry={entry} loading={loading} mutate={mutate} pending={pending} setFavorite={setFavorite} />
        <RewatchDialog anilistId={anilistId} loading={loading} />
      </div>
      {error ? <p className="mt-2 text-sm text-red-300" role="alert">{error.message} <button className="min-h-11 rounded px-2 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={error.action} type="button">Retry</button></p> : null}
    </div>
  )
}

/** Autosaves status after trailing inactivity. */
function StatusControl({ anilistId, entry, loading, mutate, pending, setStatus }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setStatus: ReturnType<typeof useMutation> }) {
  const autosave = useAnimeAutosave<AnimeStatus | null>({
    delayMs: autosaveDelayMs,
    isValid: (value) => value !== null,
    persist: (action) => mutate('status', action),
    save: async (value) => {
      if (value === null) throw new Error('Status is required.')
      await setStatus({ anilistId, status: value })
    },
    serverValue: entry?.status ?? null,
  })

  return (
    <label className={`${controlShellClass} block text-sm text-muted-foreground`}>
      <span className="block text-xs">Status</span>
      <Select disabled={loading || pending !== null} onValueChange={(value, details) => { if (value) { autosave.schedule(value as AnimeStatus); if (isKeyboardEnter(details.event)) autosave.flush(value as AnimeStatus) } }} value={autosave.value}>
        <SelectTrigger aria-label="Status" className="mt-0.5 h-6 min-h-0 rounded-none border-0 bg-transparent px-0 text-base font-semibold shadow-none hover:bg-transparent focus-visible:ring-0" disabled={loading || pending !== null} onBlur={() => { if (autosave.value) autosave.flush(autosave.value) }}>
          <SelectValue>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={autosave.value ? 'size-2.5 rounded-full bg-emerald-400' : 'size-2.5 rounded-full bg-muted-foreground/50'} data-testid="status-indicator" />
              {getStatusLabel(autosave.value)}
            </span>
          </SelectValue>
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

/** Autosaves valid scores and flushes committed values. */
function ScoreControl({ anilistId, entry, loading, mutate, pending, setScore }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setScore: ReturnType<typeof useMutation> }) {
  const autosave = useScoreAnimeAutosave({
    delayMs: autosaveDelayMs,
    persist: (action) => mutate('score', action),
    save: async (value) => await setScore({ anilistId, score: value }),
    serverValue: entry?.score ?? null,
  })
  const saving = pending === 'score'

  return (
    <div aria-busy={saving} className={controlShellClass}>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Score</span>{saving ? <span role="status">Saving…</span> : null}</span>
      <ScoreNumberField autosave={autosave} disabled={loading} />
      <ScoreValidationError message={autosave.error} />
    </div>
  )
}

/** Renders the bounded score field with reference-style chevrons. */
function ScoreNumberField({ autosave, disabled }: { autosave: ScoreAutosave; disabled: boolean }) {
  return <NumberFieldPrimitive.Root allowOutOfRange disabled={disabled} max={10} min={0} onValueChange={autosave.schedule} step={0.5} value={autosave.value}><NumberFieldPrimitive.Group className="mt-0.5 flex h-6 items-center"><StarIcon className="mr-2 size-4 shrink-0 fill-amber-300 text-amber-300" /><NumberFieldPrimitive.Input aria-describedby={autosave.error ? 'anime-score-error' : undefined} aria-invalid={Boolean(autosave.error)} aria-label="Score" className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-foreground" max={10} min={0} onBlur={autosave.commit} onClick={(event) => event.currentTarget.select()} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (event.key === 'Enter') autosave.commit() }} placeholder="0" step={0.5} /><span className="flex h-7 w-7 shrink-0 flex-col border-l border-border"><NumberFieldPrimitive.Increment aria-label="Increase score" className="grid flex-1 place-items-center text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:bg-cyan-300/10 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" disabled={disabled}><ChevronUpIcon className="size-3.5" /></NumberFieldPrimitive.Increment><NumberFieldPrimitive.Decrement aria-label="Decrease score" className="grid flex-1 place-items-center text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:bg-cyan-300/10 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" disabled={disabled}><ChevronDownIcon className="size-3.5" /></NumberFieldPrimitive.Decrement></span></NumberFieldPrimitive.Group></NumberFieldPrimitive.Root>
}

/** Announces direct-entry validation errors. */
function ScoreValidationError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-300" id="anime-score-error" role="alert">{message}</p>
}

/** Persists favorite changes immediately. */
function FavoriteControl({ anilistId, entry, loading, mutate, pending, setFavorite }: { anilistId: number; entry: ControlEntry; loading: boolean; mutate: AnimeMutation; pending: SaveKey | null; setFavorite: ReturnType<typeof useMutation> }) {
  const favorite = entry?.isFavorite ?? false

  return <button aria-pressed={favorite} className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 font-bold transition hover:border-cyan-300 hover:bg-cyan-300/5 hover:text-cyan-300 focus-visible:border-cyan-300 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={loading || pending !== null} onClick={() => mutate('favorite', async () => await setFavorite({ anilistId, isFavorite: !favorite }))} type="button"><HeartIcon className={`size-5 ${favorite ? 'fill-coral-400 text-coral-400' : ''}`} />Favorite</button>
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
  return <Dialog onOpenChange={setOpen} open={open}><DialogTrigger className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 font-bold transition hover:border-cyan-300 hover:bg-cyan-300/5 hover:text-cyan-300 focus-visible:border-cyan-300 focus-visible:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={loading}><HistoryIcon className="size-5" />Rewatch history</DialogTrigger>{open ? <DialogContent title="Rewatch history"><RewatchHistory anilistId={anilistId} /></DialogContent> : null}</Dialog>
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

/** Maps internal status values to their exact user-facing labels. */
function getStatusLabel(status: AnimeStatus | null): string {
  return statuses.find((option) => option.value === status)?.label ?? 'Set status'
}

/** Replaces first page after mutations and appends later pages without duplicates. */
export const reconcileRewatchItems = (current: AnimeRewatchEntry[], page: AnimeRewatchEntry[], cursor: string | null): AnimeRewatchEntry[] => cursor === null ? page : [...current, ...page.filter((item) => !current.some((entry) => entry.id === item.id))]
