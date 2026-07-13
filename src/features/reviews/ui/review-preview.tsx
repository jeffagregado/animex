import type { ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewDocumentRenderer } from './review-document-renderer'

type ReviewPreviewProps = { document: ReviewDocumentV1; rating: number | null; summary: string; summaryHasSpoiler: boolean }

/** Mirrors published output through shared structured renderer. */
export function ReviewPreview({ document, rating, summary, summaryHasSpoiler }: ReviewPreviewProps) {
  return <section aria-label="Live preview" className="rounded-xl border border-border bg-card/30 p-5"><h2 className="mb-5 text-lg font-black">Live preview</h2><p className="text-3xl font-black text-amber-300">★ <span className="text-foreground">{rating === null ? '—' : rating.toFixed(1)}</span> <span className="text-base font-normal text-muted-foreground">/ 100</span></p>{summary ? <p className={`mt-4 italic ${summaryHasSpoiler ? 'rounded-lg bg-cyan-300/10 p-3 text-cyan-200' : 'text-muted-foreground'}`}>{summaryHasSpoiler ? 'Summary contains spoilers' : summary}</p> : null}<div className="mt-6"><ReviewDocumentRenderer document={document} /></div></section>
}
