import { Component, useState, type ReactNode } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { EditIcon, EyeIcon, HeartIcon, Trash2Icon, UserRoundIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import { reviewListItemSchema, type ReviewDetail, type ReviewListItem, type Visibility } from '#/features/social/shared/social-contracts'
import { parseReviewWireDetail } from '../review-document-adapter'
import { getVisibilityLabel } from '#/features/social/visibility'
import { ReviewDocumentRenderer } from './review-document-renderer'
import { ReviewSummary } from './review-summary'

/** Loads one public/owner-visible Review and renders its strict document. */
export function ReviewDetailPage({ reviewId }: { reviewId: string }) {
  return <ReviewDetailBoundary><ReviewDetailContent reviewId={reviewId} /></ReviewDetailBoundary>
}

export function ReviewDetailContent({ reviewId }: { reviewId: string }) {
  const raw = useQuery(api.reviews.getById, { reviewId: reviewId as Id<'reviews'> })
  const auth = usePublicAuthState()
  const convex = useConvexAuth()
  if (raw === undefined) return <DetailState title="Loading Review…" message="Fetching the latest Review." loading />
  if (raw === null) return <DetailState title="Review not found" message="This Review is unavailable or private." loading={false} />
  const review = parseReviewWireDetail(raw)
  const owner = isReviewOwner(auth, convex.isAuthenticated, review.author.id)
  const signedIn = auth.status === 'ready' && auth.authState.status === 'complete' && convex.isAuthenticated
  return <main className="mx-auto grid max-w-[1480px] gap-7 px-4 py-6 pb-28 md:px-7 md:pb-12 lg:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]"><article className="min-w-0"><a className="text-sm font-bold text-cyan-300 hover:underline" href={`/anime/${review.anime.anilistId}/${review.anime.slug}?tab=reviews`}>← Back to {review.anime.title} reviews</a><AnimeHeader review={review} /><AuthorHeader review={review} /><div className="grid gap-5 border-b border-border py-5 sm:grid-cols-[15rem_1fr]"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Review Rating</p><p className="mt-1 text-5xl font-black">{review.rating?.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">/ 100</span></p></div><Summary review={review} /></div><div className="py-6"><ReviewDocumentRenderer document={review.body} /></div>{owner ? <OwnerActions review={review} /> : null}{signedIn ? <button className="mt-5 flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-muted-foreground" disabled title="Coming in Phase 6" type="button"><HeartIcon className="size-5" />Like · Coming in Phase 6</button> : null}</article><aside className="space-y-4"><section className="rounded-xl border border-border bg-card/40 p-5"><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">About this anime</p><div className="mt-4 flex gap-4">{review.anime.coverImageUrl ? <img alt={`${review.anime.title} cover`} className="h-36 w-24 rounded-lg object-cover" src={review.anime.coverImageUrl} /> : <span className="grid h-36 w-24 place-items-center rounded-lg bg-white/5"><UserRoundIcon /></span>}<div><h2 className="font-black">{review.anime.title}</h2><a className="mt-4 inline-block min-h-11 rounded-lg border border-border px-4 py-3 font-bold hover:border-cyan-300" href={`/anime/${review.anime.anilistId}/${review.anime.slug}`}>View anime</a></div></div></section><MoreReviews anilistId={review.anime.anilistId} currentReviewId={review.id} slug={review.anime.slug} /></aside></main>
}

function MoreReviews({ anilistId, currentReviewId, slug }: { anilistId: number; currentReviewId: string; slug: string }) {
  const raw = useQuery(api.reviews.listForAnime, { anilistId, sort: 'newest', cursor: null })
  if (raw === undefined) return <section aria-busy="true" className="rounded-xl border border-border bg-card/40 p-5"><h2 className="font-black">More reviews</h2><p className="mt-3 text-muted-foreground">Loading reviews…</p></section>
  const reviews = raw.items.map((item: unknown) => reviewListItemSchema.parse(item)).filter((item: ReviewListItem) => item.id !== currentReviewId).slice(0, 3)
  return <section className="rounded-xl border border-border bg-card/40 p-5"><h2 className="font-black">More reviews</h2>{reviews.length > 0 ? <ul className="mt-3 space-y-3">{reviews.map((item: ReviewListItem) => <li key={item.id}><a className="block rounded-lg border border-border p-3 hover:border-cyan-300" href={`/reviews/${item.id}`}><span className="font-bold">{item.author.displayName}</span><span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">{item.summaryHasSpoiler ? 'Spoiler summary hidden' : item.summary}</span></a></li>)}</ul> : <p className="mt-3 text-muted-foreground">No other reviews yet.</p>}<a className="mt-4 inline-block text-cyan-300 hover:underline" href={`/anime/${anilistId}/${slug}?tab=reviews`}>View all reviews for this anime</a></section>
}

class ReviewDetailBoundary extends Component<{ children: ReactNode }, { error: Error | null; key: number }> {
  state: { error: Error | null; key: number } = { error: null, key: 0 }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() { return this.state.error ? <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div><h1 className="text-2xl font-black">Review unavailable</h1><p className="mt-2 text-red-200" role="alert">{this.state.error.message}</p><button className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold" onClick={() => this.setState(({ key }) => ({ error: null, key: key + 1 }))} type="button">Retry</button></div></main> : <div key={this.state.key}>{this.props.children}</div> }
}

function AnimeHeader({ review }: { review: ReviewDetail }) { return <header className="mt-4 flex items-center gap-4 border-b border-border pb-4">{review.anime.coverImageUrl ? <img alt="" className="h-20 w-14 rounded object-cover" src={review.anime.coverImageUrl} /> : null}<div><h1 className="text-2xl font-black">{review.anime.title}</h1><p className="mt-1 text-muted-foreground">Full Review</p></div></header> }
function AuthorHeader({ review }: { review: ReviewDetail }) { return <header className="flex items-center gap-3 border-b border-border py-4">{review.author.avatarUrl ? <img alt={`${review.author.displayName} avatar`} className="size-12 rounded-full object-cover" src={review.author.avatarUrl} /> : <span className="grid size-12 place-items-center rounded-full bg-cyan-300/10 font-black text-cyan-300">{review.author.displayName.slice(0, 1)}</span>}<div><p className="font-black">{review.author.displayName}</p><p className="text-sm text-muted-foreground">Published {new Date(review.publishedAt ?? review.updatedAt).toLocaleDateString()} · Visibility: <span className="capitalize text-cyan-300">{review.visibility}</span>{review.updatedAt !== review.publishedAt ? ' · Updated' : ''}</p></div></header> }

function Summary({ review }: { review: ReviewDetail }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Summary</p><ReviewSummary hasSpoiler={review.summaryHasSpoiler} summary={review.summary} variant="detail" /><p className="mt-1 text-sm text-muted-foreground">Summary contains {review.summaryHasSpoiler ? '' : 'no '}spoilers</p></div> }

function OwnerActions({ review }: { review: ReviewDetail }) {
  const [confirm, setConfirm] = useState<'activity' | 'delete' | null>(null)
  const [pending, setPending] = useState(false)
  const setVisibility = useMutation(api.reviews.setVisibility)
  const removeActivity = useMutation(api.reviews.removeActivity)
  const remove = useMutation(api.reviews.remove)
  const navigate = useNavigate()
  const changeVisibility = async (visibility: Visibility): Promise<void> => { setPending(true); try { await setVisibility({ reviewId: review.id as Id<'reviews'>, visibility }); toast.success('Review visibility updated.') } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Visibility update failed.') } finally { setPending(false) } }
  const confirmed = async (): Promise<void> => { if (!confirm) return; setPending(true); try { if (confirm === 'activity') { await removeActivity({ reviewId: review.id as Id<'reviews'> }); toast.success('Review activity removed from feed.'); setConfirm(null) } else { await remove({ reviewId: review.id as Id<'reviews'> }); toast.success('Review deleted.'); await navigate({ to: '/anime/$anilistId/$slug', params: { anilistId: String(review.anime.anilistId), slug: review.anime.slug }, search: { tab: 'reviews' }, replace: true }) } } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Review action failed.') } finally { setPending(false) } }
  return <section aria-label="Owner actions" className="border-t border-border pt-5"><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Owner actions</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><a className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-400/60 text-cyan-300" href={`/reviews/${review.id}/edit`}><EditIcon className="size-4" />Edit review</a><Select disabled={pending} onValueChange={(value) => { if (value) void changeVisibility(value as Visibility) }} value={review.visibility}><SelectTrigger aria-label="Change visibility" className="min-h-11"><EyeIcon className="size-4" /><SelectValue>{getVisibilityLabel(review.visibility)}</SelectValue></SelectTrigger><SelectContent>{(['public', 'followers', 'private'] as Visibility[]).map((value) => <SelectItem key={value} value={value}>{getVisibilityLabel(value)}</SelectItem>)}</SelectContent></Select><button className="min-h-11 rounded-lg border border-border font-bold" disabled={pending} onClick={() => setConfirm('activity')} type="button">Remove feed activity</button><button className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-500 text-red-300" disabled={pending} onClick={() => setConfirm('delete')} type="button"><Trash2Icon className="size-4" />Delete review</button></div><Dialog onOpenChange={(open) => { if (!open) setConfirm(null) }} open={confirm !== null}>{confirm ? <DialogContent title={confirm === 'delete' ? 'Delete Review?' : 'Remove feed activity?'}><p className="mt-4 text-muted-foreground">{confirm === 'delete' ? 'This permanently deletes the Review.' : 'The Review stays on Anime Reviews and Review Detail.'}</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-border" onClick={() => setConfirm(null)} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white" disabled={pending} onClick={() => void confirmed()} type="button">Confirm</button></div></DialogContent> : null}</Dialog></section>
}

function DetailState({ title, message, loading }: { title: string; message: string; loading: boolean }) { return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div aria-busy={loading}><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p></div></main> }
export const isReviewOwner = (auth: ClientAuthState, convexAuthenticated: boolean, authorId: string): boolean => auth.status === 'ready' && auth.authState.status === 'complete' && convexAuthenticated && auth.authState.profile.id === authorId
