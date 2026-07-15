import type { ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewDocumentRenderer } from './review-document-renderer'
import { ReviewSpoilerBadge } from './review-spoiler-badge'
import { ReviewSummary } from './review-summary'

type ReviewPreviewProps = { document: ReviewDocumentV1; rating: number | null; summary: string; containsSpoiler: boolean }

/** Mirrors published output through shared structured renderer. */
export function ReviewPreview({ document, rating, summary, containsSpoiler }: ReviewPreviewProps) {
  return <section aria-label="Live preview" className="rounded-xl border border-border bg-card/30 p-5"><h2 className="mb-5 text-lg font-black">Live preview</h2><div className="flex items-center gap-3"><p className="text-3xl font-black text-amber-300">★ <span className="text-foreground">{rating === null ? '—' : rating.toFixed(1)}</span> <span className="text-base font-normal text-muted-foreground">/ 100</span></p>{containsSpoiler ? <ReviewSpoilerBadge /> : null}</div><ReviewSummary summary={summary} variant="detail" /><div className="mt-6"><ReviewDocumentRenderer document={document} /></div></section>
}
