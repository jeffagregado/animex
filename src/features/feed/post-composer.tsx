import { useEffect, useRef, useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { useBlocker } from '@tanstack/react-router'
import { ImageIcon, VideoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Checkbox } from '#/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { PostMedia } from '../social/shared/external-media'
import { POST_TEXT_LIMIT, type Visibility } from '../social/shared/social-contracts'
import { getVisibilityLabel } from '../social/visibility'
import { usePostComposer } from './use-post-composer'

interface PostComposerProps {
  initial: { text: string; media: PostMedia | null; hasSpoiler: boolean; visibility: Visibility }
  postId: string | null
  onCancel: () => void
  onSaved: () => void
  registerClose: (handler: () => Promise<void>) => void
}

const errorMessage = (cause: unknown, fallback: string): string => cause instanceof Error ? cause.message : fallback

interface PostMediaFieldsProps {
  draft: { type: 'image' | 'video'; url: string; copy: string } | null
  error: string | null
  disabled: boolean
  remove: () => void
  setCopy: (copy: string) => void
  setType: (type: 'image' | 'video') => void
  setUrl: (url: string) => void
}

/** Renders explicit one-media type and URL controls. */
// fallow-ignore-next-line complexity -- Small JSX state matrix stays colocated with its controls.
function PostMediaFields({ draft, error, disabled, remove, setCopy, setType, setUrl }: PostMediaFieldsProps) {
  const mediaLabel = draft?.type === 'image' ? 'Image' : 'Video'
  return <section aria-labelledby="post-media-heading" className="space-y-3 rounded-lg border border-white/10 p-3">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold" id="post-media-heading">Media (optional)</h3>{draft ? <button className="min-h-10 rounded-lg px-3 text-sm font-bold text-red-300 hover:bg-red-950/40 focus-visible:ring-2 focus-visible:ring-red-300" disabled={disabled} onClick={remove} type="button">Remove media</button> : null}</div>
    <div className="grid grid-cols-2 gap-3">
      <button aria-pressed={draft?.type === 'image'} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={disabled} onClick={() => setType('image')} type="button"><ImageIcon className="size-5" />Image</button>
      <button aria-pressed={draft?.type === 'video'} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={disabled} onClick={() => setType('video')} type="button"><VideoIcon className="size-5" />Video</button>
    </div>
    {draft ? <div className="space-y-3">
      <label className="block text-sm font-bold">{mediaLabel} URL<input aria-describedby={error ? 'post-media-error' : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-background px-3 font-normal outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30" disabled={disabled} onChange={(event) => setUrl(event.target.value)} placeholder="https://" type="url" value={draft.url} /></label>
      <label className="block text-sm font-bold">{mediaLabel} {draft.type === 'image' ? 'description' : 'label'} (optional)<input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-background px-3 font-normal outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30" disabled={disabled} onChange={(event) => setCopy(event.target.value)} value={draft.copy} /></label>
      {error ? <p className="text-sm text-red-300" id="post-media-error" role="alert">{error}</p> : null}
    </div> : null}
  </section>
}

/** Renders text, one external media URL, spoiler, and visibility fields. */
export function PostComposer({ initial, postId, onCancel, onSaved, registerClose }: PostComposerProps) {
  const composer = usePostComposer(initial)
  const savedRef = useRef(false)
  const blocker = useBlocker({ shouldBlockFn: () => composer.dirty && !savedRef.current, enableBeforeUnload: () => composer.dirty && !savedRef.current, withResolver: true })
  const [discardIntent, setDiscardIntent] = useState<'close' | 'navigate' | null>(null)

  const requestClose = async (): Promise<void> => {
    if (composer.submitting) return
    if (composer.dirty) { setDiscardIntent('close'); return }
    onCancel()
  }
  useEffect(() => { registerClose(requestClose) }, [composer.dirty, composer.submitting, registerClose])
  useEffect(() => { if (blocker.status === 'blocked') setDiscardIntent('navigate') }, [blocker.status])

  const stay = (): void => {
    if (discardIntent === 'navigate' && blocker.status === 'blocked') blocker.reset()
    setDiscardIntent(null)
  }
  const discard = (): void => {
    const intent = discardIntent
    setDiscardIntent(null)
    if (intent === 'navigate' && blocker.status === 'blocked') blocker.proceed()
    else onCancel()
  }
  const save = async (): Promise<void> => {
    try {
      await composer.submit(postId)
      savedRef.current = true
      if (blocker.status === 'blocked') blocker.reset()
      toast.success(postId ? 'Post updated.' : 'Post published.')
      onSaved()
    } catch (cause) {
      toast.error(errorMessage(cause, 'Post could not be saved.'))
    }
  }

  return <>
    <form className="mt-5 space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void save() }}>
      <label className="block"><span className="sr-only">Post text</span><textarea autoFocus className="min-h-32 w-full resize-y rounded-lg border border-white/10 bg-white/[0.025] p-3 outline-none placeholder:text-muted-foreground hover:border-cyan-300/40 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-60" disabled={composer.submitting} maxLength={POST_TEXT_LIMIT} onChange={(event) => composer.setText(event.target.value)} placeholder="What are you watching?" value={composer.text} /></label>
      <p className="text-right text-sm text-muted-foreground">{composer.text.length}/{POST_TEXT_LIMIT}</p>
      <PostMediaFields disabled={composer.submitting} draft={composer.mediaDraft} error={composer.mediaError} remove={composer.removeMedia} setCopy={composer.setMediaCopy} setType={composer.setMediaType} setUrl={composer.setMediaUrl} />
      <div className="grid gap-3 sm:grid-cols-2"><Select disabled={composer.submitting} onValueChange={(value) => { if (value) composer.setVisibility(value as Visibility) }} value={composer.visibility}><SelectTrigger aria-label="Post visibility"><SelectValue>{getVisibilityLabel(composer.visibility)}</SelectValue></SelectTrigger><SelectContent>{(['public', 'followers', 'private'] as Visibility[]).map((value) => <SelectItem key={value} value={value}>{getVisibilityLabel(value)}</SelectItem>)}</SelectContent></Select><div className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 px-3"><Checkbox checked={composer.hasSpoiler} disabled={composer.submitting} id="post-has-spoiler" onCheckedChange={(checked) => composer.setHasSpoiler(checked)} /><label htmlFor="post-has-spoiler">Hide whole Post as spoiler</label></div></div>
      <div className="flex justify-end gap-3"><button className="min-h-11 rounded-lg px-4 font-bold text-muted-foreground hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={composer.submitting} onClick={() => void requestClose()} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-coral-400 px-5 font-black text-slate-950 hover:bg-coral-300 focus-visible:ring-2 focus-visible:ring-coral-200 disabled:opacity-50" disabled={composer.submitting} type="submit">{composer.submitting ? 'Saving…' : postId ? 'Save Post' : 'Publish Post'}</button></div>
    </form>
    <AlertDialogPrimitive.Root onOpenChange={(open) => { if (!open) stay() }} open={discardIntent !== null}><AlertDialogPrimitive.Portal><AlertDialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/75" /><AlertDialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-card p-5 shadow-2xl"><AlertDialogPrimitive.Title className="text-lg font-black">Discard unsaved Post?</AlertDialogPrimitive.Title><AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">Your text and media changes will be lost.</AlertDialogPrimitive.Description><div className="mt-5 flex justify-end gap-3"><AlertDialogPrimitive.Close className="min-h-11 rounded-lg px-4 font-bold">Keep editing</AlertDialogPrimitive.Close><button className="min-h-11 rounded-lg bg-red-500 px-4 font-black text-white" onClick={discard} type="button">Discard</button></div></AlertDialogPrimitive.Popup></AlertDialogPrimitive.Portal></AlertDialogPrimitive.Root>
  </>
}
