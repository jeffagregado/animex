import { useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import type { FeedCard, Visibility } from '../social/shared/social-contracts'
import { PostComposer } from './post-composer'

/** Shares one responsive desktop dialog/mobile bottom-sheet flow. */
export function PostComposerDialog({ open, initialVisibility, edit, onClose, onSaved }: { open: boolean; initialVisibility: Visibility; edit: Extract<FeedCard, { kind: 'post' }> | null; onClose: () => void; onSaved: () => void }) {
  const closeRef = useRef<(() => Promise<void>) | null>(null)
  const initial = edit ? { text: edit.text, media: edit.media, hasSpoiler: edit.hasSpoiler, visibility: edit.visibility } : { text: '', media: null, hasSpoiler: false, visibility: initialVisibility }
  return <DialogPrimitive.Root onOpenChange={(next) => { if (!next) { if (!closeRef.current) throw new Error('Post composer close handler is unavailable.'); void closeRef.current() } }} open={open}>{open ? <DialogPrimitive.Portal><DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" /><DialogPrimitive.Popup className="scrollbar-themed fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-white/10 bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,36rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"><DialogPrimitive.Title className="pr-12 text-xl font-black">{edit ? 'Edit Post' : 'Create Post'}</DialogPrimitive.Title><DialogPrimitive.Close aria-label="Close Post composer" className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300"><XIcon className="size-5" /></DialogPrimitive.Close><PostComposer initial={initial} onCancel={onClose} onSaved={onSaved} postId={edit?.postId ?? null} registerClose={(handler) => { closeRef.current = handler }} /></DialogPrimitive.Popup></DialogPrimitive.Portal> : null}</DialogPrimitive.Root>
}
