import { useState } from 'react'
import { useMutation } from 'convex/react'
import { EditIcon, EyeIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { FeedCard, Visibility } from '../social/shared/social-contracts'
import { getVisibilityLabel } from '../social/visibility'

type OwnerCard = Extract<FeedCard, { kind: 'post' | 'completed' | 'rewatched' }>

/** Routes owner actions to source-specific mutations. */
export function FeedOwnerActions({ card, onEdit, onChanged }: { card: OwnerCard; onEdit: () => void; onChanged: () => void }) {
  const postVisibility = useMutation(api.posts.setVisibility)
  const removePost = useMutation(api.posts.remove)
  const activityVisibility = useMutation(api.feed.setActivityVisibility)
  const removeActivity = useMutation(api.feed.removeActivity)
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const changeVisibility = async (visibility: Visibility): Promise<void> => { setPending(true); try { if (card.kind === 'post') await postVisibility({ postId: card.postId as Id<'posts'>, visibility }); else await activityVisibility({ cardId: card.id as Id<'feedCards'>, visibility }); toast.success('Visibility updated.'); onChanged() } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Visibility update failed.') } finally { setPending(false) } }
  const remove = async (): Promise<void> => { setPending(true); try { if (card.kind === 'post') await removePost({ postId: card.postId as Id<'posts'> }); else await removeActivity({ cardId: card.id as Id<'feedCards'> }); toast.success(card.kind === 'post' ? 'Post deleted.' : 'Activity removed.'); setConfirmDelete(false); setOpen(false); onChanged() } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Delete failed.') } finally { setPending(false) } }
  return <><button aria-label="Owner actions" className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => setOpen(true)} type="button"><EyeIcon className="size-5" /></button><Dialog onOpenChange={setOpen} open={open}>{open ? <DialogContent title="Owner actions"><div className="mt-5 space-y-3">{card.kind === 'post' ? <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/40 font-bold text-cyan-200" onClick={() => { setOpen(false); onEdit() }} type="button"><EditIcon className="size-4" />Edit Post</button> : null}<Select disabled={pending} onValueChange={(value) => { if (value) void changeVisibility(value as Visibility) }} value={card.visibility}><SelectTrigger aria-label="Change visibility"><SelectValue>{getVisibilityLabel(card.visibility)}</SelectValue></SelectTrigger><SelectContent>{(['public', 'followers', 'private'] as Visibility[]).map((value) => <SelectItem key={value} value={value}>{getVisibilityLabel(value)}</SelectItem>)}</SelectContent></Select><button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-500/60 font-bold text-red-300" disabled={pending} onClick={() => setConfirmDelete(true)} type="button"><Trash2Icon className="size-4" />{card.kind === 'post' ? 'Delete Post' : 'Remove activity'}</button></div></DialogContent> : null}</Dialog><Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>{confirmDelete ? <DialogContent title={card.kind === 'post' ? 'Delete Post?' : 'Remove activity?'}><p className="mt-4 text-muted-foreground">{card.kind === 'post' ? 'This permanently deletes the Post and its images.' : 'This removes the milestone from your feed.'}</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-white/15" onClick={() => setConfirmDelete(false)} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white" disabled={pending} onClick={() => void remove()} type="button">Confirm</button></div></DialogContent> : null}</Dialog></>
}
