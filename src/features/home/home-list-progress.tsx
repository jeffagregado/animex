import { useEffect, useState } from 'react'
import { useConvex } from 'convex/react'
import { RefreshCwIcon } from 'lucide-react'
import { z } from 'zod'

import { api } from '../../../convex/_generated/api'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress, ProgressLabel } from '#/components/ui/progress'

const progressSchema = z.object({ watching: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), planned: z.number().int().nonnegative(), dropped: z.number().int().nonnegative() }).strict()
type UserAnimeProgress = z.infer<typeof progressSchema>
type ProgressState = { value: UserAnimeProgress | null; loading: boolean; error: string | null }
const metrics: { key: keyof UserAnimeProgress; label: string }[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'planned', label: 'Plan to Watch' },
  { key: 'dropped', label: 'Dropped' },
]

/** Loads signed-in List Progress while retaining successful values on refresh failure. */
export function HomeListProgress() {
  const client = useConvex()
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ProgressState>({ value: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    void client.query(api.userAnime.getMyProgress, {}).then((raw) => {
      if (active) setState({ value: progressSchema.parse(raw), loading: false, error: null })
    }).catch((cause: unknown) => {
      if (active) setState((current) => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'List Progress could not be loaded.' }))
    })
    return () => { active = false }
  }, [client, request])

  const retry = (): void => setRequest((current) => current + 1)
  const total = state.value === null ? 0 : metrics.reduce((sum, metric) => sum + state.value![metric.key], 0)
  return <Card size="sm"><CardHeader className="grid-cols-[1fr_auto]"><CardTitle><h2 className="text-xl font-extrabold">List Progress</h2></CardTitle><Button aria-label="Refresh List Progress" disabled={state.loading} onClick={retry} size="icon-sm" variant="ghost"><RefreshCwIcon className={state.loading ? 'animate-spin motion-reduce:animate-none' : ''} /></Button></CardHeader><CardContent>{state.loading && state.value === null ? <div aria-label="List Progress loading" className="h-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /> : null}{state.error === null ? null : <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert"><p>{state.error}</p><Button aria-label="Retry List Progress" className="mt-2" onClick={retry} size="sm" variant="outline">Retry</Button></div>}{state.value === null ? null : total === 0 ? <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No list activity yet.</p> : <div className="space-y-3">{metrics.map((metric) => { const count = state.value![metric.key]; const percent = (count / total) * 100; return <Progress key={metric.key} value={percent}><ProgressLabel>{metric.label}</ProgressLabel><span className="ml-auto text-sm tabular-nums text-muted-foreground">{count}</span></Progress> })}</div>}</CardContent></Card>
}
