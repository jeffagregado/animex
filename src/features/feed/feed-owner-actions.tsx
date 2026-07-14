import { useEffect, useRef, useState, type RefObject } from 'react'
import { useMutation } from 'convex/react'
import { CheckIcon, EditIcon, EllipsisIcon, Globe2Icon, LockIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import type { FeedCard, Visibility } from '../social/shared/social-contracts'
import { getVisibilityLabel } from '../social/visibility'

type OwnerCard = FeedCard
type DeleteAction = 'remove' | 'remove-review-activity' | null

interface OwnerActionState {
  changeDeleteOpen: (open: boolean) => void
  changeVisibility: (visibility: Visibility) => Promise<void>
  deleteAction: DeleteAction
  pending: boolean
  requestDelete: (action: Exclude<DeleteAction, null>) => void
  remove: () => Promise<void>
  triggerRef: RefObject<HTMLButtonElement | null>
}

interface RemoveMutations {
  activity: (args: { cardId: Id<'feedCards'> }) => Promise<null>
  post: (args: { postId: Id<'posts'> }) => Promise<null>
  reviewActivity: (args: { reviewId: Id<'reviews'> }) => Promise<null>
}

interface DeleteCopy {
  description: string
  title: string
}

const visibilityIcon = (visibility: Visibility) => {
  if (visibility === 'public') return <Globe2Icon />
  if (visibility === 'followers') return <UsersIcon />
  return <LockIcon />
}

/** Removes owner content through its source mutation. */
const removeOwnerSource = async (card: OwnerCard, mutations: RemoveMutations): Promise<string> => {
  if (card.kind === 'post') {
    await mutations.post({ postId: card.postId as Id<'posts'> })
    return 'Post deleted.'
  }
  if (card.kind === 'review') {
    await mutations.reviewActivity({ reviewId: card.reviewId as Id<'reviews'> })
    return 'Activity removed.'
  }
  await mutations.activity({ cardId: card.id as Id<'feedCards'> })
  return 'Activity removed.'
}

/** Describes the selected destructive owner action. */
const getDeleteCopy = (card: OwnerCard): DeleteCopy => {
  if (card.kind === 'post') return { title: 'Delete Post?', description: 'This permanently deletes the Post.' }
  if (card.kind !== 'review') return { title: 'Remove activity?', description: 'This removes the milestone from your feed.' }
  return { title: 'Remove feed activity?', description: 'The Review stays on Anime Reviews and Review Detail.' }
}

/** Routes owner actions to source-specific mutations. */
export function FeedOwnerActions({ card, onEdit, onChanged }: { card: OwnerCard; onEdit: () => void; onChanged: () => void }) {
  const actions = useOwnerActions(card, onChanged)

  return <><DropdownMenu><DropdownMenuTrigger aria-busy={actions.pending} aria-label="Owner actions" className="grid size-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 data-popup-open:bg-cyan-300/10 data-popup-open:text-cyan-300 data-popup-open:ring-2 data-popup-open:ring-cyan-300 disabled:cursor-wait disabled:bg-cyan-300/10 disabled:text-cyan-300 disabled:opacity-100" disabled={actions.pending} ref={actions.triggerRef}><EllipsisIcon className="size-5" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48" sideOffset={6}>{card.kind === 'post' ? <DropdownMenuItem disabled={actions.pending} onClick={onEdit}><EditIcon />Edit Post</DropdownMenuItem> : null}{card.kind === 'review' ? <DropdownMenuItem disabled={actions.pending} render={<a href={`/reviews/${card.reviewId}/edit`} />}><EditIcon />Edit Review</DropdownMenuItem> : null}{(['public', 'followers', 'private'] as Visibility[]).map((visibility) => <DropdownMenuItem disabled={actions.pending || visibility === card.visibility} key={visibility} onClick={() => void actions.changeVisibility(visibility)}>{visibilityIcon(visibility)}{getVisibilityLabel(visibility)}{visibility === card.visibility ? <CheckIcon className="ml-auto" /> : null}</DropdownMenuItem>)}<DropdownMenuSeparator />{card.kind === 'review' ? <DropdownMenuItem disabled={actions.pending} onClick={() => actions.requestDelete('remove-review-activity')} variant="destructive"><Trash2Icon />Remove</DropdownMenuItem> : <DropdownMenuItem disabled={actions.pending} onClick={() => actions.requestDelete('remove')} variant="destructive"><Trash2Icon />Delete</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu><DeleteConfirmation action={actions.deleteAction} card={card} onOpenChange={actions.changeDeleteOpen} onRemove={actions.remove} pending={actions.pending} /></>
}

function useOwnerActions(card: OwnerCard, onChanged: () => void): OwnerActionState {
  const postVisibility = useMutation(api.posts.setVisibility)
  const removePost = useMutation(api.posts.remove)
  const activityVisibility = useMutation(api.feed.setActivityVisibility)
  const removeActivity = useMutation(api.feed.removeActivity)
  const reviewVisibility = useMutation(api.reviews.setVisibility)
  const removeReviewActivity = useMutation(api.reviews.removeActivity)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreAfterVisibilityRef = useRef(false)
  const [deleteAction, setDeleteAction] = useState<DeleteAction>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (pending || !restoreAfterVisibilityRef.current) return
    restoreAfterVisibilityRef.current = false
    triggerRef.current?.focus()
  }, [pending])

  const changeDeleteOpen = (open: boolean): void => {
    if (open) return
    setDeleteAction(null)
    if (!open) queueMicrotask(() => triggerRef.current?.focus())
  }
  const requestDelete = (action: Exclude<DeleteAction, null>): void => setDeleteAction(action)
  const changeVisibility = async (visibility: Visibility): Promise<void> => {
    restoreAfterVisibilityRef.current = true
    setPending(true)
    try {
      if (card.kind === 'post') await postVisibility({ postId: card.postId as Id<'posts'>, visibility })
      else if (card.kind === 'review') await reviewVisibility({ reviewId: card.reviewId as Id<'reviews'>, visibility })
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
    if (deleteAction === null) throw new Error('Delete action is required.')
    setPending(true)
    try {
      const message = await removeOwnerSource(card, { activity: removeActivity, post: removePost, reviewActivity: removeReviewActivity })
      toast.success(message)
      changeDeleteOpen(false)
      onChanged()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Delete failed.')
    } finally {
      setPending(false)
    }
  }

  return { changeDeleteOpen, changeVisibility, deleteAction, pending, remove, requestDelete, triggerRef }
}

interface DeleteConfirmationProps {
  action: DeleteAction
  card: OwnerCard
  onOpenChange: (open: boolean) => void
  onRemove: () => Promise<void>
  pending: boolean
}

function DeleteConfirmation({ action, card, onOpenChange, onRemove, pending }: DeleteConfirmationProps) {
  const copy = action ? getDeleteCopy(card) : null
  return <Dialog onOpenChange={onOpenChange} open={action !== null}>{copy ? <DialogContent title={copy.title}><p className="mt-4 text-muted-foreground">{copy.description}</p><div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-lg border border-white/15 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-wait disabled:border-white/10 disabled:bg-white/5 disabled:text-muted-foreground disabled:opacity-60" disabled={pending} onClick={() => onOpenChange(false)} type="button">Cancel</button><button className="min-h-11 rounded-lg bg-red-500 font-black text-white hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:bg-red-500/60 disabled:text-white/70 disabled:opacity-100" disabled={pending} onClick={() => void onRemove()} type="button">{pending ? 'Deleting…' : 'Confirm'}</button></div></DialogContent> : null}</Dialog>
}
