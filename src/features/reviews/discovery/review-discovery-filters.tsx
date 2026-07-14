import { SearchIcon } from 'lucide-react'

import { Input } from '#/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { ReviewDiscoverySearchState } from './review-discovery-state'
import type { ReviewDiscoverySort, ReviewDiscoveryVisibility, ReviewRatingBand } from '../shared/review-discovery-contracts'

interface ReviewDiscoveryFiltersProps {
  state: ReviewDiscoverySearchState
  searchText: string
  signedIn: boolean
  onSearchTextChange: (value: string) => void
  onStateChange: (state: ReviewDiscoverySearchState) => void
}

const sortOptions: Array<{ label: string; value: ReviewDiscoverySort }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Highest Rating', value: 'rating-high' },
  { label: 'Lowest Rating', value: 'rating-low' },
]
const ratingOptions: Array<{ label: string; value: ReviewRatingBand | 'any' }> = [
  { label: 'Any rating', value: 'any' },
  ...(['90-100', '80-89', '70-79', '60-69', '50-59', '40-49', '30-39', '20-29', '10-19', '0-9'] as ReviewRatingBand[])
    .map((value) => ({ label: value.replace('-', '–'), value })),
]
const visibilityOptions: Array<{ label: string; value: ReviewDiscoveryVisibility }> = [
  { label: 'All visibility', value: 'all' },
  { label: 'Public', value: 'public' },
  { label: 'My Followers', value: 'followers' },
  { label: 'My Private', value: 'private' },
]

/** Renders URL-backed Review discovery search and filters. */
export function ReviewDiscoveryFilters(props: ReviewDiscoveryFiltersProps) {
  const searching = props.state.query !== null
  return <section aria-label="Review filters" className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-3">
    <label className="relative col-span-2 min-w-0 lg:col-span-3">
      <span className="sr-only">Search reviews</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Search reviews" className="h-12 min-w-0 pl-10" maxLength={100} onChange={(event) => props.onSearchTextChange(event.target.value)} placeholder="Search anime or author..." type="search" value={props.searchText} />
    </label>
    <Filter label="Sort">
      <Select disabled={searching} onValueChange={(value) => { if (value) props.onStateChange({ ...props.state, sort: value as ReviewDiscoverySort }) }} value={props.state.sort}>
        <SelectTrigger aria-label="Sort reviews" className="min-h-11"><SelectValue>{searching ? 'Relevance' : sortOptions.find((option) => option.value === props.state.sort)?.label}</SelectValue></SelectTrigger>
        <SelectContent><SelectGroup>{sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Filter>
    <Filter label="Rating">
      <Select onValueChange={(value) => { if (value) props.onStateChange({ ...props.state, ratingBand: value === 'any' ? null : value as ReviewRatingBand }) }} value={props.state.ratingBand ?? 'any'}>
        <SelectTrigger aria-label="Rating filter" className="min-h-11"><SelectValue>{ratingOptions.find((option) => option.value === (props.state.ratingBand ?? 'any'))?.label}</SelectValue></SelectTrigger>
        <SelectContent><SelectGroup>{ratingOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Filter>
    {props.signedIn ? <Filter className="col-span-2 lg:col-span-1" label="Visibility">
      <Select onValueChange={(value) => { if (value) props.onStateChange({ ...props.state, visibility: value as ReviewDiscoveryVisibility }) }} value={props.state.visibility}>
        <SelectTrigger aria-label="Visibility filter" className="min-h-11"><SelectValue>{visibilityOptions.find((option) => option.value === props.state.visibility)?.label}</SelectValue></SelectTrigger>
        <SelectContent><SelectGroup>{visibilityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Filter> : null}
  </section>
}

function Filter({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return <label className={`grid min-w-0 gap-2 text-sm text-muted-foreground ${className ?? ''}`}><span>{label}</span>{children}</label>
}
