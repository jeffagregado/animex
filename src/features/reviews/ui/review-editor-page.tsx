import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { FileTextIcon, SendIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { AnimeDetail } from '#/features/anime-detail/shared/anime-detail-contracts'
import { REVIEW_RATING_DEFAULT, type ReviewDetail, type Visibility } from '#/features/social/shared/social-contracts'
import { REVIEW_DOCUMENT_MAX_VISIBLE_TEXT, REVIEW_SUMMARY_LIMIT, type ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { createEmptyReviewDocument, parseReviewWireDetail, serializeReviewEditorState } from '../review-document-adapter'
import { getReviewVisibleTextLength, isCompleteReviewRating, parseReviewRating, validateReviewEditorFields, type ReviewSaveMode } from '../review-validation'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import { getVisibilityLabel } from '#/features/social/visibility'
import { createReviewRequestState, getReviewRequestId, settleReviewRequest } from '../review-request-ids'
import { ReviewEditor } from './review-editor'
import { ReviewPreview } from './review-preview'

type ReviewEditorAnime = Pick<AnimeDetail, 'anilistId' | 'coverImageUrl' | 'episodes' | 'format' | 'seasonYear' | 'slug' | 'titles'>
type ReviewEditorPageProps = { anime: ReviewEditorAnime | null; mode: 'create' | 'edit'; reviewId: string | null }
type EditorFields = { body: ReviewDocumentV1; rating: string; summary: string; containsSpoiler: boolean; visibility: Visibility }
const visibilityOptions: Visibility[] = ['private', 'followers', 'public']

/** Owns Review Draft/Publish persistence, preview, and unsaved-navigation safety. */
export function ReviewEditorPage({ anime, mode, reviewId }: ReviewEditorPageProps) {
  const auth = usePublicAuthState()
  const navigate = useNavigate()
  const mine = useQuery(api.reviews.getMineForAnime, mode === 'create' && anime ? { anilistId: anime.anilistId } : 'skip')
  const edit = useQuery(api.reviews.getById, mode === 'edit' && reviewId ? { reviewId: reviewId as Id<'reviews'> } : 'skip')
  const raw = mode === 'create' ? mine : edit
  const existing = raw === undefined || raw === null ? null : parseReviewWireDetail(raw)
  useEffect(() => {
    if (mode === 'create' && existing?.state === 'published') void navigate({ to: '/reviews/$reviewId', params: { reviewId: existing.id }, replace: true })
  }, [existing?.id, existing?.state, mode, navigate])
  if (mode === 'create' && anime === null) throw new Error('Create Review requires anime details.')
  if (mode === 'create' && mine === undefined) return <EditorLoading />
  if (mode === 'edit' && edit === undefined) return <EditorLoading />
  if (mode === 'edit' && raw === null) return <EditorState title="Review not found" message="This Review is unavailable or no longer editable." />
  if (mode === 'create' && existing?.state === 'published') return <EditorLoading />
  if (mode === 'edit' && existing?.state !== 'published') return <EditorState title="Published Review required" message="Drafts resume from the anime Reviews tab." />
  if (auth.status !== 'ready' || auth.authState.status !== 'complete') return <EditorLoading />
  if (mode === 'edit' && (existing === null || auth.status !== 'ready' || auth.authState.status !== 'complete' || auth.authState.profile.id !== existing.author.id)) return <EditorState title="Review unavailable" message="Only the Review owner can edit it." />
  const editorAnime = anime ?? { anilistId: existing!.anime.anilistId, coverImageUrl: existing!.anime.coverImageUrl, episodes: null, format: null, seasonYear: null, slug: existing!.anime.slug, titles: { display: existing!.anime.title, english: null, native: null, romaji: null } }
  return <LoadedReviewEditor anime={editorAnime} defaultVisibility={auth.authState.profile.visibility} existing={existing} mode={mode} />
}

export function LoadedReviewEditor({ anime, defaultVisibility, existing, mode }: { anime: ReviewEditorAnime; defaultVisibility: Visibility; existing: ReviewDetail | null; mode: 'create' | 'edit' }) {
  const [fields, setFields] = useState<EditorFields>(() => existing ? fromExisting(existing) : { body: createEmptyReviewDocument(), rating: String(REVIEW_RATING_DEFAULT), summary: '', containsSpoiler: false, visibility: defaultVisibility })
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<ReviewSaveMode | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [editorInvalid, setEditorInvalid] = useState(false)
  const [attemptedVisibleCount, setAttemptedVisibleCount] = useState<number | null>(null)
  const [completedReviewId, setCompletedReviewId] = useState<string | null>(null)
  const requestState = useRef(createReviewRequestState())
  const navigate = useNavigate()
  const saveDraft = useMutation(api.reviews.saveDraft)
  const publish = useMutation(api.reviews.publish)
  const update = useMutation(api.reviews.update)
  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: dirty, withResolver: true })
  const visibleCount = getReviewVisibleTextLength(fields.body)

  useEffect(() => {
    if (completedReviewId && !dirty) void navigate({ to: '/reviews/$reviewId', params: { reviewId: completedReviewId }, replace: true, ignoreBlocker: true })
  }, [completedReviewId, dirty, navigate])

  const change = <K extends keyof EditorFields>(key: K, value: EditorFields[K]): void => { setFields((current) => ({ ...current, [key]: value })); setDirty(true); setErrors([]) }
  const persist = async (intent: ReviewSaveMode): Promise<void> => {
    if (editorInvalid) { if (errors.length === 0) setErrors(['Review body must be corrected before saving.']); return }
    const nextErrors = validateReviewEditorFields(fields, intent)
    if (nextErrors.length > 0) { setErrors(nextErrors); return }
    const rating = parseReviewRating(fields.rating)
    setPending(intent)
    setErrors([])
    try {
      const bodyJson = serializeReviewEditorState(fields.body.editorState)
      const requestPayload = JSON.stringify({ rating, summary: fields.summary, containsSpoiler: fields.containsSpoiler, bodyJson, visibility: fields.visibility })
      if (mode === 'edit') {
        if (!existing || rating === null) throw new Error('Published Review requires an editable Rating.')
        await update({ reviewId: existing.id as Id<'reviews'>, rating, summary: fields.summary, containsSpoiler: fields.containsSpoiler, bodyJson, visibility: fields.visibility })
        setDirty(false); setCompletedReviewId(existing.id); toast.success('Review updated.')
      } else if (intent === 'draft') {
        const request = getReviewRequestId(requestState.current, 'draft', requestPayload, () => crypto.randomUUID())
        requestState.current = request.state
        await saveDraft({ anilistId: anime.anilistId, requestId: request.id, rating, summary: fields.summary, containsSpoiler: fields.containsSpoiler, bodyJson, visibility: fields.visibility })
        requestState.current = settleReviewRequest(requestState.current, 'draft', request.id)
        setDirty(false); toast.success('Draft saved.')
      } else {
        if (rating === null) throw new Error('Published Review requires a Rating.')
        const request = getReviewRequestId(requestState.current, 'publish', requestPayload, () => crypto.randomUUID())
        requestState.current = request.state
        const id = await publish({ anilistId: anime.anilistId, requestId: request.id, rating, summary: fields.summary, containsSpoiler: fields.containsSpoiler, bodyJson, visibility: fields.visibility })
        requestState.current = settleReviewRequest(requestState.current, 'publish', request.id)
        setDirty(false); setCompletedReviewId(id); toast.success('Review published.')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Review could not be saved.'
      setErrors([message]); toast.error(message)
    } finally { setPending(null) }
  }

  const onEditorChange = (body: ReviewDocumentV1): void => { setAttemptedVisibleCount(null); setEditorInvalid(false); if (JSON.stringify(body) !== JSON.stringify(fields.body)) change('body', body) }
  const onEditorError = (error: Error): void => { setEditorInvalid(true); setDirty(true); setErrors([error.message]) }
  const onLimitExceeded = (attemptedCount: number): void => { setAttemptedVisibleCount(attemptedCount); setErrors([`Attempted ${attemptedCount.toLocaleString()} visible characters. Limit is ${REVIEW_DOCUMENT_MAX_VISIBLE_TEXT.toLocaleString()}; last insertion was reverted.`]) }
  const previewRating = getPreviewRating(fields.rating)
  return <main className="mx-auto max-w-[1480px] px-4 py-6 pb-28 md:px-7 md:pb-12"><AnimeIdentity anime={anime} /><h1 className="mt-6 text-3xl font-black">{mode === 'edit' ? 'Edit review' : 'Write a review'}</h1><div className="mt-5 grid grid-cols-2 border border-border lg:hidden"><button className={`min-h-12 font-bold ${tab === 'editor' ? 'border-b-2 border-cyan-300 text-cyan-300' : 'text-muted-foreground'}`} onClick={() => setTab('editor')} type="button">Editor</button><button className={`min-h-12 font-bold ${tab === 'preview' ? 'border-b-2 border-cyan-300 text-cyan-300' : 'text-muted-foreground'}`} onClick={() => setTab('preview')} type="button">Preview</button></div><div className="mt-5 grid gap-7 lg:grid-cols-2"><section className={tab === 'preview' ? 'hidden lg:block' : ''}><ReviewFields disabled={pending !== null} fields={fields} onChange={change} /><ReviewEditor document={fields.body} onChange={onEditorChange} onError={onEditorError} onLimitExceeded={onLimitExceeded} /><p className={`mt-2 text-right text-sm ${attemptedVisibleCount !== null || editorInvalid ? 'text-red-300' : 'text-muted-foreground'}`}>{attemptedVisibleCount !== null ? `Attempted ${attemptedVisibleCount.toLocaleString()}; current ` : ''}{visibleCount.toLocaleString()} / {REVIEW_DOCUMENT_MAX_VISIBLE_TEXT.toLocaleString()} visible characters</p></section><div className={tab === 'editor' ? 'hidden lg:block' : ''}><ReviewPreview document={fields.body} rating={previewRating} summary={fields.summary} containsSpoiler={fields.containsSpoiler} /></div></div>{errors.length > 0 ? <ul className="mt-5 rounded-lg border border-red-400/50 bg-red-400/5 p-4 text-red-200" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-2xl"><button className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-border font-bold hover:border-cyan-300" disabled={pending !== null || mode === 'edit'} onClick={() => void persist('draft')} type="button"><FileTextIcon className="size-5" />{pending === 'draft' ? 'Saving…' : 'Save draft'}</button><button className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-coral-400 font-black text-white hover:bg-coral-300" disabled={pending !== null} onClick={() => void persist('publish')} type="button"><SendIcon className="size-5" />{pending === 'publish' ? 'Saving…' : mode === 'edit' ? 'Update review' : 'Publish review'}</button></div><Dialog onOpenChange={(open) => { if (!open && blocker.status === 'blocked') blocker.reset() }} open={blocker.status === 'blocked'}>{blocker.status === 'blocked' ? <DialogContent title="Discard unsaved changes?"><p className="mt-4 text-muted-foreground">Your latest Review edits have not been saved.</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-border font-bold" onClick={blocker.reset} type="button">Stay</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white" onClick={blocker.proceed} type="button">Discard</button></div></DialogContent> : null}</Dialog></main>
}

function ReviewFields({ disabled, fields, onChange }: { disabled: boolean; fields: EditorFields; onChange: <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => void }) {
  return <div className="mb-5 grid gap-4 md:grid-cols-[10rem_1fr_11rem]"><label className="text-sm font-bold">Review Rating<input aria-label="Review Rating" className="mt-2 min-h-12 w-full rounded-lg border border-border bg-card px-3 text-xl font-black" inputMode="decimal" onChange={(event) => onChange('rating', event.currentTarget.value)} type="text" value={fields.rating} /></label><label className="text-sm font-bold">Summary <span className="float-right font-normal text-muted-foreground">{fields.summary.length} / {REVIEW_SUMMARY_LIMIT}</span><input className="mt-2 min-h-12 w-full rounded-lg border border-border bg-card px-3" maxLength={REVIEW_SUMMARY_LIMIT} onChange={(event) => onChange('summary', event.currentTarget.value)} value={fields.summary} /></label><label className="text-sm font-bold">Visibility<Select onValueChange={(value) => { if (value) onChange('visibility', value as Visibility) }} value={fields.visibility}><SelectTrigger className="mt-2 min-h-12"><SelectValue>{getVisibilityLabel(fields.visibility)}</SelectValue></SelectTrigger><SelectContent>{visibilityOptions.map((value) => <SelectItem key={value} value={value}>{getVisibilityLabel(value)}</SelectItem>)}</SelectContent></Select></label><div className="flex min-h-11 w-full items-center justify-end gap-2 text-sm text-muted-foreground md:col-span-3" data-review-spoiler-row><Checkbox checked={fields.containsSpoiler} disabled={disabled} id="review-contains-spoiler" onCheckedChange={(checked) => onChange('containsSpoiler', checked)} /><label htmlFor="review-contains-spoiler">Review contains spoiler</label></div></div>
}

function AnimeIdentity({ anime }: { anime: ReviewEditorAnime }) { return <header className="flex items-center gap-4 border-b border-border pb-5">{anime.coverImageUrl ? <img alt={`${anime.titles.display} cover`} className="h-28 w-20 rounded-lg object-cover" src={anime.coverImageUrl} /> : null}<div><p className="text-2xl font-black">{anime.titles.display}</p><p className="mt-2 text-muted-foreground">{[anime.format, anime.seasonYear, anime.episodes === null ? null : `${anime.episodes} episodes`].filter(Boolean).join(' · ')}</p></div></header> }
function EditorLoading() { return <main className="mx-auto max-w-[1480px] px-4 py-10"><div className="h-32 animate-pulse rounded-xl bg-white/5" /><div className="mt-6 h-96 animate-pulse rounded-xl bg-white/5" /></main> }
function EditorState({ title, message }: { title: string; message: string }) { return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p></div></main> }
const fromExisting = (review: ReviewDetail): EditorFields => ({ body: review.body, rating: review.rating === null ? '' : String(review.rating), summary: review.summary, containsSpoiler: review.containsSpoiler, visibility: review.visibility })
const getPreviewRating = (value: string): number | null => isCompleteReviewRating(value) ? Number(value) : null
