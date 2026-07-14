import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  mergeRegister,
  type LexicalNode,
  type RangeSelection,
} from 'lexical'

import { ReviewImageNode } from '../lexical/review-image-node'
import { ReviewVideoNode } from '../lexical/review-video-node'

const isReviewMediaNode = (node: LexicalNode | null): node is ReviewImageNode | ReviewVideoNode => node instanceof ReviewImageNode || node instanceof ReviewVideoNode

/** Registers Review media selection and keyboard deletion. */
export function ReviewMediaEditingPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => mergeRegister(
    editor.registerCommand(CLICK_COMMAND, (event) => {
      const target = event.target
      if (!(target instanceof Node)) return false
      const node = $getNearestNodeFromDOMNode(target)
      if (!isReviewMediaNode(node)) return false
      event.preventDefault()
      const selection = $createNodeSelection()
      selection.add(node.getKey())
      $setSelection(selection)
      return true
    }, COMMAND_PRIORITY_LOW),
    editor.registerCommand(KEY_BACKSPACE_COMMAND, (event) => removeReviewMedia(event, 'backward'), COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_DELETE_COMMAND, (event) => removeReviewMedia(event, 'forward'), COMMAND_PRIORITY_NORMAL),
  ), [editor])
  return null
}

/** Removes selected or caret-adjacent Review media and restores a range caret. */
const removeReviewMedia = (event: KeyboardEvent, direction: 'backward' | 'forward'): boolean => {
  const selection = $getSelection()
  const selectedNode = $isNodeSelection(selection) ? selection.getNodes().find(isReviewMediaNode) ?? null : null
  const node = selectedNode ?? ($isRangeSelection(selection) ? getAdjacentReviewMedia(selection, direction) : null)
  if (node === null) return false
  event.preventDefault()
  if (direction === 'backward') node.selectPrevious()
  else node.selectNext()
  node.remove()
  return true
}

/** Finds media immediately outside a collapsed block boundary. */
const getAdjacentReviewMedia = (selection: RangeSelection, direction: 'backward' | 'forward'): ReviewImageNode | ReviewVideoNode | null => {
  if (!selection.isCollapsed()) return null
  const anchor = selection.anchor
  const anchorNode = anchor.getNode()
  const block = anchorNode.getTopLevelElement()
  if (block === null) return null
  if (!isBlockBoundary(selection, direction)) return null
  const node = direction === 'backward' ? block.getPreviousSibling() : block.getNextSibling()
  return isReviewMediaNode(node) ? node : null
}

/** Checks whether a collapsed selection sits at requested block edge. */
const isBlockBoundary = (selection: RangeSelection, direction: 'backward' | 'forward'): boolean => {
  const anchor = selection.anchor
  const node = anchor.getNode()
  const block = node.getTopLevelElement()
  if (block === null) return false
  if (direction === 'backward') return anchor.offset === 0 && [block, block.getFirstDescendant()].includes(node)
  return anchor.offset === node.getTextContentSize() && [block, block.getLastDescendant()].includes(node)
}
