/** Renders a noninteractive accessible Discover loading state. */
export function DiscoverRoutePending() {
  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-4 sm:px-6 lg:px-10" aria-busy="true">
      <section className="space-y-3" role="status" aria-live="polite">
        <h1 className="text-xl font-extrabold sm:text-2xl">Loading Discover</h1>
        <div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden="true" />
      </section>
    </main>
  )
}

/** Renders actionable route loader failure recovery. */
export function DiscoverRouteError({ error: _error, reset }: { error: Error, reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-4 sm:px-6 lg:px-10">
      <section className="rounded-xl border border-destructive/50 bg-destructive/10 p-5" role="alert">
        <h1 className="text-xl font-extrabold">Could not load Discover</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and retry.</p>
        <button className="mt-4 rounded-md border border-border px-4 py-2 font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" onClick={reset}>
          Retry Discover
        </button>
      </section>
    </main>
  )
}
