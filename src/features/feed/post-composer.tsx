import { useEffect, useRef } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { ImagePlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { POST_IMAGE_LIMIT, POST_TEXT_LIMIT, type Visibility } from '../social/shared/social-contracts'
import { PostImageGrid } from './post-image-grid'
import { usePostComposer } from './use-post-composer'

interface PostComposerProps { initial: { text: string; imageIds: string[]; imageUrls: string[]; hasSpoiler: boolean; visibility: Visibility }; postId: string | null; onCancel: () => void; onSaved: () => void; registerClose: (handler: () => Promise<void>) => void }

/** Renders full text/image/spoiler/visibility Post form. */
export function PostComposer({ initial, postId, onCancel, onSaved, registerClose }: PostComposerProps) {
  const composer = usePostComposer(initial)
  const blocker = useBlocker({ shouldBlockFn: () => composer.dirty, enableBeforeUnload: composer.dirty, withResolver: true })
  const fileInput = useRef<HTMLInputElement>(null)
  const cancel = async (): Promise<void> => {
    if (composer.dirty && !window.confirm('Discard unsaved Post and pending uploads?')) return
    await composer.discardAll(); onCancel()
  }
  useEffect(() => { registerClose(cancel) }, [composer.dirty, composer.images, registerClose])
  useEffect(() => {
    if (blocker.status !== 'blocked') return
    if (!window.confirm('Discard unsaved Post and pending uploads?')) { blocker.reset(); return }
    void composer.discardAll().then(() => blocker.proceed())
  }, [blocker.status])
  const save = async (): Promise<void> => { try { await composer.submit(postId); toast.success(postId ? 'Post updated.' : 'Post published.'); onSaved() } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Post could not be saved.') } }
  return <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void save() }}><label className="block"><span className="sr-only">Post text</span><textarea autoFocus className="min-h-32 w-full resize-y rounded-lg border border-white/10 bg-white/[0.025] p-3 outline-none placeholder:text-muted-foreground hover:border-cyan-300/40 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30" maxLength={POST_TEXT_LIMIT} onChange={(event) => composer.setText(event.target.value)} placeholder="What are you watching?" value={composer.text} /></label><p className="text-right text-sm text-muted-foreground">{composer.text.length}/{POST_TEXT_LIMIT}</p>{composer.images.length > 0 ? <PostImageGrid images={composer.images} move={composer.move} remove={(index) => void composer.remove(index)} /> : null}<div className="grid gap-3 sm:grid-cols-2"><button className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50" disabled={composer.images.length >= POST_IMAGE_LIMIT} onClick={() => fileInput.current?.click()} type="button"><ImagePlusIcon className="size-5" />Add images</button><input accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" multiple onChange={(event) => { Array.from(event.target.files ?? []).slice(0, POST_IMAGE_LIMIT - composer.images.length).forEach((file) => void composer.upload(file)); event.target.value = '' }} ref={fileInput} type="file" /><Select onValueChange={(value) => { if (value) composer.setVisibility(value as Visibility) }} value={composer.visibility}><SelectTrigger aria-label="Post visibility"><SelectValue /></SelectTrigger><SelectContent>{(['public', 'followers', 'private'] as Visibility[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 px-3"><input checked={composer.hasSpoiler} className="size-5 accent-cyan-300" onChange={(event) => composer.setHasSpoiler(event.target.checked)} type="checkbox" /><span>Hide whole Post as spoiler</span></label><div className="grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-white/15 font-bold hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => void cancel()} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-coral-400 font-black text-slate-950 hover:bg-coral-300 focus-visible:ring-2 focus-visible:ring-coral-200 disabled:opacity-50" disabled={composer.submitting || composer.images.some((image) => image.status === 'processing' || image.status === 'uploading')} type="submit">{composer.submitting ? 'Publishing…' : postId ? 'Save changes' : 'Publish Post'}</button></div></form>
}
