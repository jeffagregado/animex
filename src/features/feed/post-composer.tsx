import { useEffect, useRef, useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { useBlocker } from '@tanstack/react-router'
import { ImagePlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { POST_IMAGE_LIMIT, POST_TEXT_LIMIT, type Visibility } from '../social/shared/social-contracts'
import { PostImageGrid } from './post-image-grid'
import { usePostComposer } from './use-post-composer'

interface PostComposerProps {
  initial: { text: string; imageIds: string[]; imageUrls: string[]; hasSpoiler: boolean; visibility: Visibility }
  postId: string | null
  onCancel: () => void
  onSaved: () => void
  registerClose: (handler: () => Promise<void>) => void
}

const errorMessage = (cause: unknown, fallback: string): string => cause instanceof Error ? cause.message : fallback

/** Renders text/image/spoiler/visibility form with themed dirty confirmation. */
export function PostComposer({ initial, postId, onCancel, onSaved, registerClose }: PostComposerProps) {
  const composer = usePostComposer(initial)
  const savedRef = useRef(false)
  const blocker = useBlocker({ shouldBlockFn: () => composer.dirty && !savedRef.current, enableBeforeUnload: () => composer.dirty && !savedRef.current, withResolver: true })
  const fileInput = useRef<HTMLInputElement>(null)
  const [discardIntent, setDiscardIntent] = useState<'close' | 'navigate' | null>(null)

  const requestClose = async (): Promise<void> => {
    if (composer.submitting) return
    if (composer.dirty) { setDiscardIntent('close'); return }
    try { await composer.discardAll(); onCancel() }
    catch (cause) { toast.error(`Post cleanup failed: ${errorMessage(cause, 'pending images could not be discarded.')}`) }
  }
  useEffect(() => { registerClose(requestClose) }, [composer.dirty, composer.submitting, registerClose])
  useEffect(() => { if (blocker.status === 'blocked') setDiscardIntent('navigate') }, [blocker.status])

  const stay = (): void => {
    if (discardIntent === 'navigate' && blocker.status === 'blocked') blocker.reset()
    setDiscardIntent(null)
  }
  const discard = async (): Promise<void> => {
    try { await composer.discardAll() }
    catch (cause) { toast.error(`Post cleanup failed: ${errorMessage(cause, 'pending images could not be discarded.')}`); return }
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
    }
    catch (cause) { toast.error(errorMessage(cause, 'Post could not be saved.')) }
  }
  const removeImage = async (index: number): Promise<void> => {
    try { await composer.remove(index) }
    catch (cause) { toast.error(`Image cleanup failed: ${errorMessage(cause, 'pending image could not be discarded.')}`) }
  }
  const uploadFiles = async (files: File[]): Promise<void> => {
    for (const file of files) {
      try { await composer.upload(file) }
      catch (cause) { toast.error(errorMessage(cause, 'Image could not be uploaded.')) }
    }
  }

  const waiting = composer.images.some((image) => image.status === 'processing' || image.status === 'uploading')
  const failed = composer.images.some((image) => image.status === 'error')
  return <>
    <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <label className="block">
        <span className="sr-only">Post text</span>
        <textarea autoFocus className="min-h-32 w-full resize-y rounded-lg border border-white/10 bg-white/[0.025] p-3 outline-none placeholder:text-muted-foreground hover:border-cyan-300/40 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-60" disabled={composer.submitting} maxLength={POST_TEXT_LIMIT} onChange={(event) => composer.setText(event.target.value)} placeholder="What are you watching?" value={composer.text} />
      </label>
      <p className="text-right text-sm text-muted-foreground">{composer.text.length}/{POST_TEXT_LIMIT}</p>
      {composer.images.length > 0 ? <PostImageGrid disabled={composer.submitting} images={composer.images} move={composer.move} remove={(index) => { void removeImage(index) }} /> : null}
      {failed ? <p className="rounded-lg border border-red-400/40 bg-red-950/20 p-3 text-sm text-red-200" role="alert">Remove failed images before publishing.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" disabled={composer.submitting || composer.images.length >= POST_IMAGE_LIMIT} onClick={() => fileInput.current?.click()} type="button"><ImagePlusIcon className="size-5" />Add images</button>
        <input accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={composer.submitting} multiple onChange={(event) => { const files = Array.from(event.target.files ?? []).slice(0, POST_IMAGE_LIMIT - composer.images.length); void uploadFiles(files); event.target.value = '' }} ref={fileInput} type="file" />
        <Select disabled={composer.submitting} onValueChange={(value) => { if (value) composer.setVisibility(value as Visibility) }} value={composer.visibility}>
          <SelectTrigger aria-label="Post visibility"><SelectValue /></SelectTrigger>
          <SelectContent>{(['public', 'followers', 'private'] as Visibility[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 px-3"><input checked={composer.hasSpoiler} className="size-5 accent-cyan-300" disabled={composer.submitting} onChange={(event) => composer.setHasSpoiler(event.target.checked)} type="checkbox" /><span>Hide whole Post as spoiler</span></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="min-h-11 rounded-lg border border-white/15 font-bold hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" disabled={composer.submitting} onClick={() => { void requestClose() }} type="button">Cancel</button>
        <button className="min-h-11 rounded-lg bg-coral-400 font-black text-slate-950 hover:bg-coral-300 focus-visible:ring-2 focus-visible:ring-coral-200 disabled:opacity-50" disabled={composer.submitting || waiting || failed} type="submit">{composer.submitting ? 'Publishing…' : postId ? 'Save changes' : 'Publish Post'}</button>
      </div>
    </form>
    <AlertDialogPrimitive.Root onOpenChange={(open) => { if (!open) stay() }} open={discardIntent !== null}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm" />
        <AlertDialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-70 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-card p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          <AlertDialogPrimitive.Title className="text-xl font-black">Discard unsaved Post?</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-3 text-muted-foreground">Pending uploads and unsaved changes will be removed.</AlertDialogPrimitive.Description>
          <div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-white/15 font-bold" onClick={stay} type="button">Stay</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white" onClick={() => { void discard() }} type="button">Discard</button></div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  </>
}
