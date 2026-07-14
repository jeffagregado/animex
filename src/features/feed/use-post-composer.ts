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
  const create = useMutation(api.posts.create)
  const update = useMutation(api.posts.update)
  const operationId = useRef(newId())
  const submittingRef = useRef(false)
  const [text, setText] = useState(initial.text)
  const [mediaDraft, setMediaDraft] = useState<PostMediaDraft | null>(() => toDraft(initial.media))
  const [hasSpoiler, setHasSpoiler] = useState(initial.hasSpoiler)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const [submitting, setSubmitting] = useState(false)

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
    if (submittingRef.current) throw new Error('Wait for Post submission to finish.')
    setMediaDraft(null)
  }

  let mediaError: string | null = null
  if (mediaDraft) {
    try { parseMediaDraft(mediaDraft) }
    catch (cause) { mediaError = cause instanceof Error ? cause.message : 'Invalid Post media.' }
  }

  const submit = async (postId: string | null): Promise<void> => {
    if (submittingRef.current) throw new Error('Post submission is already running.')
    const media = parseMediaDraft(mediaDraft)
    const parsed = createPostInputSchema.safeParse({ requestId: operationId.current, text, media, hasSpoiler, visibility })
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Post could not be validated.')
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (postId) await update({ postId: postId as Id<'posts'>, ...parsed.data })
      else await create(parsed.data)
      setText('')
      setMediaDraft(null)
      setHasSpoiler(false)
      operationId.current = newId()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const dirty = text !== initial.text
    || JSON.stringify(mediaDraft) !== JSON.stringify(toDraft(initial.media))
    || hasSpoiler !== initial.hasSpoiler
    || visibility !== initial.visibility

  return { text, setText, mediaDraft, mediaError, setMediaType, setMediaUrl, setMediaCopy, removeMedia, hasSpoiler, setHasSpoiler, visibility, setVisibility, submitting, dirty, submit }
}
