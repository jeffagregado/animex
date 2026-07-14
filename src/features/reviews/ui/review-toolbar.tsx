import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import {
  $getNodeByKey,
  $getSelection,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type DecoratorNode,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from 'lexical'
import { ImageIcon, ListIcon, ListOrderedIcon, QuoteIcon, RedoIcon, StrikethroughIcon, UndoIcon, VideoIcon, EyeOffIcon } from 'lucide-react'

import { Dialog, DialogContent } from '#/components/ui/dialog'
import { getVideoProvider } from '#/features/social/shared/review-document'
import { $createReviewImageNode } from '../lexical/review-image-node'
import { $createSpoilerNode, $isSpoilerNode } from '../lexical/spoiler-node'
import { $createReviewVideoNode } from '../lexical/review-video-node'

type MediaDialog = 'image' | 'video' | null

/** Dispatches only approved Review editor commands. */
export function ReviewToolbar() {
  const [editor] = useLexicalComposerContext()
  const [dialog, setDialog] = useState<MediaDialog>(null)
  const block = (kind: 'h2' | 'h3' | 'quote'): void => formatReviewBlock(editor, kind)
  const mark = (format: TextFormatType): void => formatReviewText(editor, format)

  const [mediaSelection, setMediaSelection] = useState<RangeSelection | null>(null)
  const pendingMediaSelection = useRef<RangeSelection | null | undefined>(undefined)
  const captureMediaSelection = (): void => { pendingMediaSelection.current = captureReviewSelection(editor) }
  const openMedia = (kind: Exclude<MediaDialog, null>): void => {
    setMediaSelection(pendingMediaSelection.current === undefined ? captureReviewSelection(editor) : pendingMediaSelection.current)
    pendingMediaSelection.current = undefined
    setDialog(kind)
  }

  return <><div aria-label="Review formatting" className="flex flex-wrap items-center gap-1 border-b border-border p-2" role="toolbar"><Tool label="H2" onClick={() => block('h2')}>H2</Tool><Tool label="H3" onClick={() => block('h3')}>H3</Tool><Tool label="Quote" onClick={() => block('quote')}><QuoteIcon /></Tool><Tool label="Bulleted list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}><ListIcon /></Tool><Tool label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}><ListOrderedIcon /></Tool><Tool label="Bold" onClick={() => mark('bold')}><strong>B</strong></Tool><Tool label="Italic" onClick={() => mark('italic')}><em>I</em></Tool><Tool label="Underline" onClick={() => mark('underline')}><u>U</u></Tool><Tool label="Strikethrough" onClick={() => mark('strikethrough')}><StrikethroughIcon /></Tool><Tool label="Image" onClick={() => openMedia('image')} onPointerDown={captureMediaSelection}><ImageIcon /></Tool><Tool label="Video" onClick={() => openMedia('video')} onPointerDown={captureMediaSelection}><VideoIcon /></Tool><Tool label="Spoiler" onClick={() => markSelectedBlocksAsSpoiler(editor)}><EyeOffIcon /></Tool><Tool label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><UndoIcon /></Tool><Tool label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><RedoIcon /></Tool></div><Dialog onOpenChange={(open) => { if (!open) setDialog(null) }} open={dialog !== null}>{dialog ? <DialogContent title={dialog === 'image' ? 'Add image' : 'Add video'}><MediaForm editor={editor} kind={dialog} onDone={() => setDialog(null)} selection={mediaSelection} /></DialogContent> : null}</Dialog></>
}

/** Applies one approved inline format to the active Lexical selection. */
export const formatReviewText = (editor: ReturnType<typeof useLexicalComposerContext>[0], format: TextFormatType): void => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, format) }

/** Replaces selected text blocks with one approved semantic block type. */
export const formatReviewBlock = (editor: ReturnType<typeof useLexicalComposerContext>[0], kind: 'h2' | 'h3' | 'quote'): void => editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const blocks = selection.getNodes().map((node) => node.getTopLevelElement()).filter((node): node is ElementNode => $isElementNode(node))
    const unique = blocks.filter((node, index) => blocks.findIndex((candidate) => candidate.getKey() === node.getKey()) === index)
    unique.forEach((current) => {
      if (!['paragraph', 'heading', 'quote'].includes(current.getType())) return
      const next = kind === 'quote' ? $createQuoteNode() : $createHeadingNode(kind)
      next.append(...current.getChildren())
      current.replace(next)
    })
  }, { discrete: true })

function Tool({ children, label, onClick, onPointerDown }: { children: ReactNode; label: string; onClick: () => void; onPointerDown?: () => void }) {
  return <button aria-label={label} className="grid min-h-11 min-w-11 place-items-center rounded-md px-2 text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [&_svg]:size-5" onClick={onClick} onPointerDown={onPointerDown} title={label} type="button">{children}</button>
}

function MediaForm({ editor, kind, onDone, selection }: { editor: ReturnType<typeof useLexicalComposerContext>[0]; kind: Exclude<MediaDialog, null>; onDone: () => void; selection: RangeSelection | null }) {
  const [error, setError] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const url = String(values.get('url') ?? '').trim()
    const label = String(values.get('label') ?? '').trim()
    try {
      insertReviewMedia(editor, kind, url, label, selection)
      onDone()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Media link is invalid.') }
  }
  return <form className="mt-5 space-y-4" onSubmit={submit}><label className="block text-sm font-bold">HTTPS URL<input className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3" name="url" required type="url" /></label><label className="block text-sm font-bold">{kind === 'image' ? 'Alt text' : 'Label (optional)'}<input className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3" name="label" required={kind === 'image'} /></label>{error ? <p className="text-red-300" role="alert">{error}</p> : null}<button className="min-h-11 rounded-lg bg-cyan-300 px-5 font-black text-primary-foreground" type="submit">Add {kind}</button></form>
}

/** Validates and inserts one approved Review media node at the active selection. */
const captureReviewSelection = (editor: ReturnType<typeof useLexicalComposerContext>[0]): RangeSelection | null => editor.getEditorState().read(() => {
  const selection = $getSelection()
  return $isRangeSelection(selection) ? selection.clone() : null
})

/** Validates and inserts one approved Review media node at a captured selection. */
export const insertReviewMedia = (editor: ReturnType<typeof useLexicalComposerContext>[0], kind: Exclude<MediaDialog, null>, url: string, label: string, savedSelection: RangeSelection | null): void => {
  const provider = kind === 'video' ? getVideoProvider(url) : null
  if (kind === 'image' && label.length === 0) throw new RangeError('Image alt text is required.')
  editor.update(() => {
    const node = kind === 'image' ? $createReviewImageNode(url, label) : $createReviewVideoNode(url, provider!, label || undefined)
    const selectionIsCurrent = savedSelection !== null
      && $getNodeByKey(savedSelection.anchor.key) !== null
      && $getNodeByKey(savedSelection.focus.key) !== null
    if (selectionIsCurrent) {
      $setSelection(savedSelection.clone())
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) throw new TypeError('Expected restored Review selection.')
      if (!selection.isCollapsed()) selection.removeText()
      selection.insertNodes([node])
      return
    }
    const first = $getRoot().getFirstChild()
    if (first === null) $getRoot().append(node)
    else first.insertBefore(node)
    node.selectNext()
  }, { discrete: true })
}

/** Toggles spoiler wrappers while preserving their child blocks. */
export const markSelectedBlocksAsSpoiler = (editor: ReturnType<typeof useLexicalComposerContext>[0]): void => editor.update(() => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) return
  const selected = selection.getNodes()
  const spoilers = selected.map((node) => {
    let current = node
    while (current.getParent() !== null) {
      if ($isSpoilerNode(current)) return current
      current = current.getParentOrThrow()
    }
    return $isSpoilerNode(current) ? current : null
  }).filter((node): node is ReturnType<typeof $createSpoilerNode> => node !== null)
  const uniqueSpoilers = spoilers.filter((node, index) => spoilers.findIndex((candidate) => candidate.getKey() === node.getKey()) === index)
  if (uniqueSpoilers.length > 0) {
    uniqueSpoilers.forEach((spoiler) => {
      spoiler.getChildren().forEach((child) => spoiler.insertBefore(child))
      spoiler.remove()
    })
    return
  }
  const blocks = selected.map((node) => node.getTopLevelElement()).filter(isReviewRootBlock).filter((node) => !$isSpoilerNode(node))
  const unique = blocks.filter((node, index) => blocks.findIndex((candidate) => candidate.getKey() === node.getKey()) === index)
  if (unique.length === 0) return
  const spoiler = $createSpoilerNode()
  unique[0].insertBefore(spoiler)
  spoiler.append(...unique)
}, { discrete: true })

type ReviewRootBlock = ElementNode | DecoratorNode<unknown>

/** Narrows only root-owned element and decorator blocks. */
const isReviewRootBlock = (node: LexicalNode | null): node is ReviewRootBlock => node !== null
  && ($isElementNode(node) || $isDecoratorNode(node))
  && node.getParent() === $getRoot()
