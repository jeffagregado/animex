import { useState, type RefObject } from 'react'
import { ChevronRightIcon, ImageOffIcon, SearchIcon } from 'lucide-react'

import {
  createQuickSearchDestination,
  type QuickSearchGroup,
  type QuickSearchRow,
} from '../shared/quick-search-contracts'
import type { QuickSearchModel } from './use-quick-search'

const labels: Record<QuickSearchGroup, string> = {
  anime: 'Anime',
  characters: 'Characters',
  staff: 'Staff',
  users: 'Users',
}

export function QuickSearchInput({
  inputRef,
  model,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  model: QuickSearchModel
}) {
  return (
    <label className="relative block">
      <span className="sr-only">Search AnimeX</span>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        {...model.inputProps}
        ref={inputRef}
        className="min-h-11 w-full rounded-xl border border-border bg-background py-3 pr-4 pl-12 text-base outline-none transition-colors focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40 motion-reduce:duration-0"
      />
    </label>
  )
}

/** Renders independent semantic result and error lanes. */
export function QuickSearchResults({ model }: { model: QuickSearchModel }) {
  const showPrompt = model.normalizedQuery.length < 2
    || model.normalizedQuery.length > 100
  const visibleGroups = (Object.entries(model.groups) as [QuickSearchGroup, QuickSearchRow[]][])
    .filter(([, rows]) => rows.length > 0)
  return (
    <div className="min-h-0">
      <p aria-atomic="true" aria-live="polite" className="sr-only">{model.status}</p>
      <div id="quick-search-results">
        {showPrompt ? <p className="p-6 text-center text-sm text-muted-foreground">{model.status}</p> : null}
        {model.providerLoading || model.userLoading
          ? <p className="p-4 text-sm text-muted-foreground">Searching…</p>
          : null}
        {model.providerError ? (
          <ErrorLane label="Catalog search failed." onRetry={model.retryProvider} />
        ) : null}
        {model.userError ? (
          <ErrorLane label="User search failed." onRetry={model.retryUsers} />
        ) : null}
        {visibleGroups.map(([group, rows]) => (
          <ResultGroup key={group} group={group} model={model} rows={rows} />
        ))}
        {!showPrompt && model.status.startsWith('No results')
          ? <p className="p-6 text-center text-sm text-muted-foreground">{model.status}</p>
          : null}
      </div>
    </div>
  )
}

function ErrorLane({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="m-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/50 p-3 text-sm">
      <p>{label}</p>
      <button className="min-h-11 rounded-lg px-4 font-bold focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

function ResultGroup({
  group,
  model,
  rows,
}: {
  group: QuickSearchGroup
  model: QuickSearchModel
  rows: QuickSearchRow[]
}) {
  const titleId = `quick-search-${group}-title`
  const destination = createQuickSearchDestination({
    kind: 'results',
    group,
    query: model.normalizedQuery,
  })
  return (
    <section aria-labelledby={titleId} className="border-t border-border p-4 first:border-t-0">
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <h2 className="font-black" id={titleId}>{labels[group]}</h2>
        <button className="min-h-11 rounded-lg px-3 text-sm font-bold text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => model.select(destination)} type="button">
          View all
        </button>
      </div>
      <ul aria-labelledby={titleId} className="space-y-1" role="listbox">
        {rows.map((row) => {
          const index = model.items.findIndex((item) => item.optionId === `quick-search-${group}-${row.id}`)
          return (
            <li key={row.id} role="none">
              <button
                aria-selected={model.activeIndex === index}
                className="group flex min-h-14 w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-cyan-300/10 focus-visible:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 aria-selected:bg-cyan-300/15 motion-reduce:duration-0"
                id={`quick-search-${group}-${row.id}`}
                onClick={() => model.select(row.destination)}
                role="option"
                tabIndex={-1}
                type="button"
              >
                <ResultImage label={row.label} url={row.imageUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold group-hover:text-cyan-200">{row.label}</span>
                  {row.metadata === null ? null : <span className="block truncate text-xs text-muted-foreground">{row.metadata}</span>}
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ResultImage({ label, url }: { label: string; url: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
      {url !== null && !failed
        ? <img alt={`${label} image`} className="size-full object-cover" onError={() => setFailed(true)} src={url} />
        : <ImageOffIcon aria-label="Image unavailable" className="size-4 text-muted-foreground" />}
    </span>
  )
}
