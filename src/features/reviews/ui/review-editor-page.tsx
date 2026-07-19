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
import {
  activeVisibilityOptions,
  getActiveVisibilityLabel,
  getVisibilitySelection,
  resolveVisibilitySelection,
  type ActiveVisibility,
  type VisibilitySelection,
} from '#/features/social/visibility'
import { createReviewRequestState, getReviewRequestId, settleReviewRequest } from '../review-request-ids'
import { ReviewEditor } from './review-editor'
import { ReviewPreview } from './review-preview'

type ReviewEditorAnime = Pick<AnimeDetail, 'publicId' | 'coverImageUrl' | 'episodes' | 'format' | 'seasonYear' | 'slug' | 'titles'>
type ReviewEditorPageProps = { anime: ReviewEditorAnime | null; mode: 'create' | 'edit'; reviewId: string | null }
type EditorFields = { body: ReviewDocumentV1; rating: string; summary: string; containsSpoiler: boolean; visibility: VisibilitySelection }
type EditorChange = <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => void
type ReviewMutationFields = { rating: number | null; summary: string; containsSpoiler: boolean; bodyJson: string; visibility: Visibility }
type PublishedReviewMutationFields = Omit<ReviewMutationFields, 'rating'> & { rating: number }
type ReviewSaveContext = {
  animeId: Id<'catalogEntities'>
  existing: ReviewDetail | null
  fields: EditorFields
  mode: 'create' | 'edit'
  originalVisibility: Visibility
  publish: (input: PublishedReviewMutationFields & { animeId: Id<'catalogEntities'>; requestId: string }) => Promise<string>
  requestState: { current: ReturnType<typeof createReviewRequestState> }
  saveDraft: (input: ReviewMutationFields & { animeId: Id<'catalogEntities'>; requestId: string }) => Promise<unknown>
  update: (input: Omit<ReviewMutationFields, 'rating'> & { rating: number; reviewId: Id<'reviews'> }) => Promise<unknown>
}

/** Owns Review Draft/Publish persistence, preview, and unsaved-navigation safety. */
export function ReviewEditorPage({ anime, mode, reviewId }: ReviewEditorPageProps) {
  if (mode === 'create') return <CreateReviewEditorPage anime={anime} />
  return <EditReviewEditorPage reviewId={reviewId} />
}

function CreateReviewEditorPage({ anime }: { anime: ReviewEditorAnime | null }) {
  const mine = useQuery(api.reviews.getMineForAnime, anime ? { animeId: anime.publicId as Id<'catalogEntities'> } : 'skip')
  const existing = mine === undefined || mine === null ? null : parseReviewWireDetail(mine)
  usePublishedReviewRedirect(existing)
  if (anime === null) throw new Error('Create Review requires anime details.')
  if (mine === undefined || existing?.state === 'published') return <EditorLoading />
  return <AuthenticatedReviewEditor anime={anime} existing={existing} mode="create" />
}

/** Redirects create flow when viewer already published this Review. */
function usePublishedReviewRedirect(existing: ReviewDetail | null): void {
  const navigate = useNavigate()
  useEffect(() => {
    if (existing?.state === 'published') void navigate({ to: '/reviews/$reviewId', params: { reviewId: existing.id }, replace: true })
  }, [existing?.id, existing?.state, navigate])
}

function EditReviewEditorPage({ reviewId }: { reviewId: string | null }) {
  const edit = useQuery(api.reviews.getById, reviewId ? { reviewId: reviewId as Id<'reviews'> } : 'skip')
  if (edit === undefined) return <EditorLoading />
  if (edit === null) return <EditorState title="Review not found" message="This Review is unavailable or no longer editable." />
  const existing = parseReviewWireDetail(edit)
  if (existing.state !== 'published') return <EditorState title="Published Review required" message="Drafts resume from the anime Reviews tab." />
  return <AuthenticatedReviewEditor anime={toEditorAnime(existing)} existing={existing} mode="edit" />
}

function AuthenticatedReviewEditor({ anime, existing, mode }: { anime: ReviewEditorAnime; existing: ReviewDetail | null; mode: 'create' | 'edit' }) {
  const auth = usePublicAuthState()
  if (auth.status !== 'ready' || auth.authState.status !== 'complete') return <EditorLoading />
  if (mode === 'edit' && existing?.author.id !== auth.authState.profile.id) return <EditorState title="Review unavailable" message="Only the Review owner can edit it." />
  return <LoadedReviewEditor anime={anime} defaultVisibility={auth.authState.profile.visibility} existing={existing} mode={mode} />
}

export function LoadedReviewEditor({ anime, defaultVisibility, existing, mode }: { anime: ReviewEditorAnime; defaultVisibility: Visibility; existing: ReviewDetail | null; mode: 'create' | 'edit' }) {
  const originalVisibility = existing?.visibility ?? defaultVisibility
  const initialVisibility = getVisibilitySelection(originalVisibility, existing !== null)
  const [fields, setFields] = useState<EditorFields>(() => existing
    ? { ...fromExisting(existing), visibility: initialVisibility }
    : { body: createEmptyReviewDocument(), rating: String(REVIEW_RATING_DEFAULT), summary: '', containsSpoiler: false, visibility: initialVisibility })
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<ReviewSaveMode | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [editorInvalid, setEditorInvalid] = useState(false)
  const [attemptedVisibleCount, setAttemptedVisibleCount] = useState<number | null>(null)
  const [completedReviewId, setCompletedReviewId] = useState<string | null>(null)
  const requestState = useRef(createReviewRequestState())
  const navigate = useNavigate()
  const { publish, saveDraft, update } = useReviewMutations()
  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: dirty, withResolver: true })
  const visibleCount = getReviewVisibleTextLength(fields.body)

  useEffect(() => {
    if (completedReviewId && !dirty) void navigate({ to: '/reviews/$reviewId', params: { reviewId: completedReviewId }, replace: true, ignoreBlocker: true })
  }, [completedReviewId, dirty, navigate])

  const change = <K extends keyof EditorFields>(key: K, value: EditorFields[K]): void => { setFields((current) => ({ ...current, [key]: value })); setDirty(true); setErrors([]) }
  const persist = async (intent: ReviewSaveMode): Promise<void> => {
    const nextErrors = getEditorSaveErrors(editorInvalid, errors, fields, intent)
    if (nextErrors.length > 0) { setErrors(nextErrors); return }
    const rating = parseReviewRating(fields.rating)
    setPending(intent)
    setErrors([])
    try {
      const bodyJson = serializeReviewEditorState(fields.body.editorState)
      const resolvedVisibility = resolveVisibilitySelection(originalVisibility, fields.visibility)
      const requestPayload = JSON.stringify({ rating, summary: fields.summary, containsSpoiler: fields.containsSpoiler, bodyJson, visibility: resolvedVisibility })
      const completedId = await saveReview({ animeId: anime.publicId as Id<'catalogEntities'>, existing, fields, mode, originalVisibility, publish, requestState, saveDraft, update }, intent, rating, bodyJson, requestPayload)
      setDirty(false)
      setCompletedReviewId(completedId)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Review could not be saved.'
      setErrors([message]); toast.error(message)
    } finally { setPending(null) }
  }

  const onEditorChange = (body: ReviewDocumentV1): void => { setAttemptedVisibleCount(null); setEditorInvalid(false); if (JSON.stringify(body) !== JSON.stringify(fields.body)) change('body', body) }
  const onEditorError = (error: Error): void => { setEditorInvalid(true); setDirty(true); setErrors([error.message]) }
  const onLimitExceeded = (attemptedCount: number): void => { setAttemptedVisibleCount(attemptedCount); setErrors([`Attempted ${attemptedCount.toLocaleString()} visible characters. Limit is ${REVIEW_DOCUMENT_MAX_VISIBLE_TEXT.toLocaleString()}; last insertion was reverted.`]) }
  const previewRating = getPreviewRating(fields.rating)
  const blocked = blocker.status === 'blocked'
  return <main className="mx-auto max-w-[1480px] px-4 py-6 pb-28 md:px-7 md:pb-12"><AnimeIdentity anime={anime} /><h1 className="mt-6 text-3xl font-black">{mode === 'edit' ? 'Edit review' : 'Write a review'}</h1><EditorTabs tab={tab} onChange={setTab} /><EditorWorkspace attemptedVisibleCount={attemptedVisibleCount} editorInvalid={editorInvalid} fields={fields} pending={pending} previewRating={previewRating} tab={tab} visibleCount={visibleCount} onChange={change} onEditorChange={onEditorChange} onEditorError={onEditorError} onLimitExceeded={onLimitExceeded} /><ReviewErrors errors={errors} /><ReviewSaveActions mode={mode} pending={pending} onSave={persist} /><UnsavedChangesDialog blocked={blocked} onDiscard={blocker.proceed} onStay={blocker.reset} /></main>
}

/** Groups Review mutations behind one editor hook boundary. */
function useReviewMutations() {
  const saveDraft = useMutation(api.reviews.saveDraft)
  const publish = useMutation(api.reviews.publish)
  const update = useMutation(api.reviews.update)
  return { publish, saveDraft, update }
}

function EditorTabs({ tab, onChange }: { tab: 'editor' | 'preview'; onChange: (tab: 'editor' | 'preview') => void }) {
  return <div className="mt-5 grid grid-cols-2 border border-border lg:hidden"><button className={`min-h-12 font-bold ${tab === 'editor' ? 'border-b-2 border-cyan-300 text-cyan-300' : 'text-muted-foreground'}`} onClick={() => onChange('editor')} type="button">Editor</button><button className={`min-h-12 font-bold ${tab === 'preview' ? 'border-b-2 border-cyan-300 text-cyan-300' : 'text-muted-foreground'}`} onClick={() => onChange('preview')} type="button">Preview</button></div>
}

function EditorWorkspace({ attemptedVisibleCount, editorInvalid, fields, pending, previewRating, tab, visibleCount, onChange, onEditorChange, onEditorError, onLimitExceeded }: { attemptedVisibleCount: number | null; editorInvalid: boolean; fields: EditorFields; pending: ReviewSaveMode | null; previewRating: number | null; tab: 'editor' | 'preview'; visibleCount: number; onChange: EditorChange; onEditorChange: (body: ReviewDocumentV1) => void; onEditorError: (error: Error) => void; onLimitExceeded: (count: number) => void }) {
  return <div className="mt-5 grid gap-7 lg:grid-cols-2"><section className={tab === 'preview' ? 'hidden lg:block' : ''}><ReviewFields disabled={pending !== null} fields={fields} onChange={onChange} /><ReviewEditor document={fields.body} onChange={onEditorChange} onError={onEditorError} onLimitExceeded={onLimitExceeded} /><VisibleTextCount attempted={attemptedVisibleCount} invalid={editorInvalid} visible={visibleCount} /></section><div className={tab === 'editor' ? 'hidden lg:block' : ''}><ReviewPreview document={fields.body} rating={previewRating} summary={fields.summary} containsSpoiler={fields.containsSpoiler} /></div></div>
}

function VisibleTextCount({ attempted, invalid, visible }: { attempted: number | null; invalid: boolean; visible: number }) {
  return <p className={`mt-2 text-right text-sm ${attempted !== null || invalid ? 'text-red-300' : 'text-muted-foreground'}`}>{attempted !== null ? `Attempted ${attempted.toLocaleString()}; current ` : ''}{visible.toLocaleString()} / {REVIEW_DOCUMENT_MAX_VISIBLE_TEXT.toLocaleString()} visible characters</p>
}

function ReviewErrors({ errors }: { errors: string[] }) {
  return errors.length > 0 ? <ul className="mt-5 rounded-lg border border-red-400/50 bg-red-400/5 p-4 text-red-200" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null
}

function ReviewSaveActions({ mode, pending, onSave }: { mode: 'create' | 'edit'; pending: ReviewSaveMode | null; onSave: (intent: ReviewSaveMode) => Promise<void> }) {
  return <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-2xl"><button className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-border font-bold hover:border-cyan-300" disabled={pending !== null || mode === 'edit'} onClick={() => void onSave('draft')} type="button"><FileTextIcon className="size-5" />{pending === 'draft' ? 'Saving…' : 'Save draft'}</button><button className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-coral-400 font-black text-white hover:bg-coral-300" disabled={pending !== null} onClick={() => void onSave('publish')} type="button"><SendIcon className="size-5" />{pending === 'publish' ? 'Saving…' : mode === 'edit' ? 'Update review' : 'Publish review'}</button></div>
}

function UnsavedChangesDialog({ blocked, onDiscard, onStay }: { blocked: boolean; onDiscard: (() => void) | undefined; onStay: (() => void) | undefined }) {
  if (!blocked) return <Dialog onOpenChange={() => undefined} open={false} />
  if (!onDiscard || !onStay) throw new Error('Blocked navigation requires discard and stay actions.')
  return <Dialog onOpenChange={(open) => { if (!open) onStay() }} open><DialogContent title="Discard unsaved changes?"><p className="mt-4 text-muted-foreground">Your latest Review edits have not been saved.</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-border font-bold" onClick={onStay} type="button">Stay</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white" onClick={onDiscard} type="button">Discard</button></div></DialogContent></Dialog>
}

function ReviewFields({ disabled, fields, onChange }: { disabled: boolean; fields: EditorFields; onChange: EditorChange }) {
  return <div className="mb-5 grid gap-4 md:grid-cols-[10rem_1fr_11rem]"><label className="text-sm font-bold">Review Rating<input aria-label="Review Rating" className="mt-2 min-h-12 w-full rounded-lg border border-border bg-card px-3 text-xl font-black" inputMode="decimal" onChange={(event) => onChange('rating', event.currentTarget.value)} type="text" value={fields.rating} /></label><label className="text-sm font-bold">Summary <span className="float-right font-normal text-muted-foreground">{fields.summary.length} / {REVIEW_SUMMARY_LIMIT}</span><input className="mt-2 min-h-12 w-full rounded-lg border border-border bg-card px-3" maxLength={REVIEW_SUMMARY_LIMIT} onChange={(event) => onChange('summary', event.currentTarget.value)} value={fields.summary} /></label><label className="text-sm font-bold">Visibility<Select onValueChange={(value) => { if (value) onChange('visibility', value as ActiveVisibility) }} value={fields.visibility}><SelectTrigger className="mt-2 min-h-12"><SelectValue>{fields.visibility === null ? 'Change visibility' : getActiveVisibilityLabel(fields.visibility)}</SelectValue></SelectTrigger><SelectContent>{activeVisibilityOptions.map((value) => <SelectItem key={value} value={value}>{getActiveVisibilityLabel(value)}</SelectItem>)}</SelectContent></Select></label><div className="flex min-h-11 w-full items-center justify-end gap-2 text-sm text-muted-foreground md:col-span-3" data-review-spoiler-row><Checkbox checked={fields.containsSpoiler} disabled={disabled} id="review-contains-spoiler" onCheckedChange={(checked) => onChange('containsSpoiler', checked)} /><label htmlFor="review-contains-spoiler">Review contains spoiler</label></div></div>
}

function AnimeIdentity({ anime }: { anime: ReviewEditorAnime }) { return <header className="flex items-center gap-4 border-b border-border pb-5">{anime.coverImageUrl ? <img alt={`${anime.titles.display} cover`} className="h-28 w-20 rounded-lg object-cover" src={anime.coverImageUrl} /> : null}<div><p className="text-2xl font-black">{anime.titles.display}</p><p className="mt-2 text-muted-foreground">{[anime.format, anime.seasonYear, anime.episodes === null ? null : `${anime.episodes} episodes`].filter(Boolean).join(' · ')}</p></div></header> }
function EditorLoading() { return <main className="mx-auto max-w-[1480px] px-4 py-10"><div className="h-32 animate-pulse rounded-xl bg-white/5" /><div className="mt-6 h-96 animate-pulse rounded-xl bg-white/5" /></main> }
function EditorState({ title, message }: { title: string; message: string }) { return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 text-center"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p></div></main> }
const fromExisting = (review: ReviewDetail): Omit<EditorFields, 'visibility'> => ({ body: review.body, rating: review.rating === null ? '' : String(review.rating), summary: review.summary, containsSpoiler: review.containsSpoiler })
const getPreviewRating = (value: string): number | null => isCompleteReviewRating(value) ? Number(value) : null
const getEditorSaveErrors = (editorInvalid: boolean, currentErrors: string[], fields: EditorFields, intent: ReviewSaveMode): string[] => {
  if (!editorInvalid) return validateReviewEditorFields(fields, intent)
  return currentErrors.length > 0 ? currentErrors : ['Review body must be corrected before saving.']
}
const toEditorAnime = (review: ReviewDetail): ReviewEditorAnime => ({ publicId: review.anime.publicId, coverImageUrl: review.anime.coverImageUrl, episodes: null, format: null, seasonYear: null, slug: review.anime.slug, titles: { display: review.anime.title, english: null, native: null, romaji: null } })

/** Runs one Review mutation while preserving request idempotency state. */
const saveReview = async (context: ReviewSaveContext, intent: ReviewSaveMode, rating: number | null, bodyJson: string, requestPayload: string): Promise<string | null> => {
  const visibility = resolveVisibilitySelection(context.originalVisibility, context.fields.visibility)
  const fields = { rating, summary: context.fields.summary, containsSpoiler: context.fields.containsSpoiler, bodyJson, visibility }
  if (context.mode === 'edit') {
    if (!context.existing || rating === null) throw new Error('Published Review requires an editable Rating.')
    await context.update({ ...fields, rating, reviewId: context.existing.id as Id<'reviews'> })
    toast.success('Review updated.')
    return context.existing.id
  }
  if (intent === 'draft') {
    const request = getReviewRequestId(context.requestState.current, 'draft', requestPayload, () => crypto.randomUUID())
    context.requestState.current = request.state
    await context.saveDraft({ ...fields, animeId: context.animeId, requestId: request.id })
    context.requestState.current = settleReviewRequest(context.requestState.current, 'draft', request.id)
    toast.success('Draft saved.')
    return null
  }
  if (rating === null) throw new Error('Published Review requires a Rating.')
  const request = getReviewRequestId(context.requestState.current, 'publish', requestPayload, () => crypto.randomUUID())
  context.requestState.current = request.state
  const id = await context.publish({ ...fields, rating, animeId: context.animeId, requestId: request.id })
  context.requestState.current = settleReviewRequest(context.requestState.current, 'publish', request.id)
  toast.success('Review published.')
  return id
}
