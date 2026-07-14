import { useState } from 'react'
import { useMutation } from 'convex/react'
import { CheckIcon, EditIcon, EllipsisIcon, Globe2Icon, LockIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import type { FeedCard, Visibility } from '../social/shared/social-contracts'
import { getVisibilityLabel } from '../social/visibility'

type OwnerCard = Extract<FeedCard, { kind: 'post' | 'completed' | 'rewatched' }>

const visibilityIcon = (visibility: Visibility) => {
  if (visibility === 'public') return <Globe2Icon />
  if (visibility === 'followers') return <UsersIcon />
  return <LockIcon />
}

/** Routes owner actions to source-specific mutations. */
export function FeedOwnerActions({ card, onEdit, onChanged }: { card: OwnerCard; onEdit: () => void; onChanged: () => void }) {
  const postVisibility = useMutation(api.posts.setVisibility)
  const removePost = useMutation(api.posts.remove)
  const activityVisibility = useMutation(api.feed.setActivityVisibility)
  const removeActivity = useMutation(api.feed.removeActivity)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)

  const changeVisibility = async (visibility: Visibility): Promise<void> => {
    setPending(true)
    try {
      if (card.kind === 'post') await postVisibility({ postId: card.postId as Id<'posts'>, visibility })
      else await activityVisibility({ cardId: card.id as Id<'feedCards'>, visibility })
      toast.success('Visibility updated.')
      onChanged()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Visibility update failed.')
    } finally {
      setPending(false)
    }
  }

  const remove = async (): Promise<void> => {
    setPending(true)
    try {
      if (card.kind === 'post') await removePost({ postId: card.postId as Id<'posts'> })
      else await removeActivity({ cardId: card.id as Id<'feedCards'> })
      toast.success(card.kind === 'post' ? 'Post deleted.' : 'Activity removed.')
      setConfirmDelete(false)
      onChanged()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Delete failed.')
    } finally {
      setPending(false)
    }
  }

  return <><DropdownMenu><DropdownMenuTrigger aria-label="Owner actions" className="grid size-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><EllipsisIcon className="size-5" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48" sideOffset={6}>{card.kind === 'post' ? <DropdownMenuItem disabled={pending} onClick={onEdit}><EditIcon />Edit Post</DropdownMenuItem> : null}{(['public', 'followers', 'private'] as Visibility[]).map((visibility) => <DropdownMenuItem disabled={pending || visibility === card.visibility} key={visibility} onClick={() => void changeVisibility(visibility)}>{visibilityIcon(visibility)}{getVisibilityLabel(visibility)}{visibility === card.visibility ? <CheckIcon className="ml-auto" /> : null}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem disabled={pending} onClick={() => setConfirmDelete(true)} variant="destructive"><Trash2Icon />{card.kind === 'post' ? 'Delete Post' : 'Remove activity'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>{confirmDelete ? <DialogContent title={card.kind === 'post' ? 'Delete Post?' : 'Remove activity?'}><p className="mt-4 text-muted-foreground">{card.kind === 'post' ? 'This permanently deletes the Post and its images.' : 'This removes the milestone from your feed.'}</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-white/15 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={pending} onClick={() => setConfirmDelete(false)} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50" disabled={pending} onClick={() => void remove()} type="button">{pending ? 'Deleting…' : 'Confirm'}</button></div></DialogContent> : null}</Dialog></>
}
