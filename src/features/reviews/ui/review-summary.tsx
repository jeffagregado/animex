type ReviewSummaryProps = {
  summary: string
  variant: 'detail' | 'list'
}

/** Renders always-visible Summary text for detail and compact lists. */
export function ReviewSummary({ summary, variant }: ReviewSummaryProps) {
  if (summary.length === 0) return null
  return <p className={variant === 'list' ? 'mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground' : 'mt-2 text-lg italic'}>{summary}</p>
}
