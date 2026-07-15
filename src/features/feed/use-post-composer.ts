import { useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { getVideoProvider, postMediaSchema, type PostMedia } from '../social/shared/external-media'
import { createPostInputSchema, type Visibility } from '../social/shared/social-contracts'

interface PostMediaDraft {
  type: 'image' | 'video'
  url: string
  copy: string
}

interface PostComposerInitial {
  text: string
  media: PostMedia | null
  hasSpoiler: boolean
  visibility: Visibility
}

interface PostSubmitInput {
  text: string
  mediaDraft: PostMediaDraft | null
  hasSpoiler: boolean
  visibility: Visibility
  setText: (text: string) => void
  setMediaDraft: (draft: PostMediaDraft | null) => void
  setHasSpoiler: (hasSpoiler: boolean) => void
}

const newId = (): string => crypto.randomUUID()

/** Converts editable media fields into strict shared Post media. */
const parseMediaDraft = (draft: PostMediaDraft | null): PostMedia | null => {
  if (!draft) return null
  const candidate = draft.type === 'image'
    ? { type: 'image' as const, url: draft.url, description: draft.copy.trim() || null }
    : { type: 'video' as const, url: draft.url, provider: getVideoProvider(draft.url), label: draft.copy.trim() || null }
  const parsed = postMediaSchema.safeParse(candidate)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid Post media.')
  return parsed.data
}

const toDraft = (media: PostMedia | null): PostMediaDraft | null => media
  ? { type: media.type, url: media.url, copy: media.type === 'image' ? media.description ?? '' : media.label ?? '' }
  : null

/** Owns one external Post media draft and Post mutations. */
export function usePostComposer(initial: PostComposerInitial) {
  const [text, setText] = useState(initial.text)
  const [mediaDraft, setMediaDraft] = useState<PostMediaDraft | null>(() => toDraft(initial.media))
  const [hasSpoiler, setHasSpoiler] = useState(initial.hasSpoiler)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const submission = usePostSubmission({ text, mediaDraft, hasSpoiler, visibility, setText, setMediaDraft, setHasSpoiler })

  const setMediaType = (type: PostMediaDraft['type']): void => setMediaDraft((draft) => ({ type, url: draft?.url ?? '', copy: draft?.copy ?? '' }))
  const setMediaUrl = (url: string): void => setMediaDraft((draft) => {
    if (!draft) throw new Error('Choose Image or Video before entering a media URL.')
    return { ...draft, url }
  })
  const setMediaCopy = (copy: string): void => setMediaDraft((draft) => {
    if (!draft) throw new Error('Choose Image or Video before entering media details.')
    return { ...draft, copy }
  })
  const removeMedia = (): void => {
    if (submission.isSubmitting()) throw new Error('Wait for Post submission to finish.')
    setMediaDraft(null)
  }

  const mediaError = getMediaError(mediaDraft)
  const dirty = isPostComposerDirty(initial, { text, mediaDraft, hasSpoiler, visibility })

  return { text, setText, mediaDraft, mediaError, setMediaType, setMediaUrl, setMediaCopy, removeMedia, hasSpoiler, setHasSpoiler, visibility, setVisibility, submitting: submission.submitting, dirty, submit: submission.submit }
}

/** Owns Post mutation idempotency and submission locking. */
function usePostSubmission(input: PostSubmitInput) {
  const create = useMutation(api.posts.create)
  const update = useMutation(api.posts.update)
  const operationId = useRef(newId())
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (postId: string | null): Promise<void> => {
    if (submittingRef.current) throw new Error('Post submission is already running.')
    const media = parseMediaDraft(input.mediaDraft)
    const parsed = createPostInputSchema.safeParse({ requestId: operationId.current, text: input.text, media, hasSpoiler: input.hasSpoiler, visibility: input.visibility })
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Post could not be validated.')
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (postId) await update({ postId: postId as Id<'posts'>, ...parsed.data })
      else await create(parsed.data)
      input.setText('')
      input.setMediaDraft(null)
      input.setHasSpoiler(false)
      operationId.current = newId()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return { submitting, submit, isSubmitting: (): boolean => submittingRef.current }
}

/** Returns current media validation message without mutating draft state. */
const getMediaError = (draft: PostMediaDraft | null): string | null => {
  if (!draft) return null
  try { parseMediaDraft(draft); return null }
  catch (cause) { return cause instanceof Error ? cause.message : 'Invalid Post media.' }
}

/** Compares editable fields with initial Post values. */
const isPostComposerDirty = (initial: PostComposerInitial, current: Omit<PostSubmitInput, 'setText' | 'setMediaDraft' | 'setHasSpoiler'>): boolean => current.text !== initial.text
  || JSON.stringify(current.mediaDraft) !== JSON.stringify(toDraft(initial.media))
  || current.hasSpoiler !== initial.hasSpoiler
  || current.visibility !== initial.visibility
