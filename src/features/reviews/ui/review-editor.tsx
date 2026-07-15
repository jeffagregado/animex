import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $createParagraphNode, $getRoot, type EditorState, type InitialEditorStateType } from 'lexical'
import { useRef, type ReactNode } from 'react'

import { parseReviewDocument, REVIEW_DOCUMENT_MAX_VISIBLE_TEXT, type ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewImageNode } from '../lexical/review-image-node'
import { SpoilerNode } from '../lexical/spoiler-node'
import { ReviewVideoNode } from '../lexical/review-video-node'
import { ReviewToolbar } from './review-toolbar'
import { ReviewMediaEditingPlugin } from './review-media-editing-plugin'

type ReviewEditorProps = {
  document: ReviewDocumentV1
  onChange: (document: ReviewDocumentV1) => void
  onError: (error: Error) => void
  onLimitExceeded: (attemptedCount: number) => void
}

const theme = {
  heading: { h2: 'mb-2 mt-4 text-2xl font-black', h3: 'mb-2 mt-4 text-xl font-black' },
  list: { listitem: 'ml-6', nested: { listitem: 'list-none' }, ol: 'list-decimal', ul: 'list-disc marker:text-cyan-300' },
  paragraph: 'mb-4',
  quote: 'border-l-2 border-cyan-300 pl-4 italic text-muted-foreground',
  text: { bold: 'font-bold', italic: 'italic', strikethrough: 'line-through', underline: 'underline' },
}

/** Owns locked Lexical node registration and JSON-only change output. */
export function ReviewEditor({ document, onChange, onError, onLimitExceeded }: ReviewEditorProps) {
  const lastValid = useRef(document)
  const initialConfig = {
    editorState: getEditorInitialState(document),
    namespace: 'AnimeXReviewEditor',
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, SpoilerNode, ReviewImageNode, ReviewVideoNode],
    onError,
    theme,
  }
  const change = (state: EditorState, editor: Parameters<typeof acceptReviewEditorChange>[0]['editor'], tags: Set<string>): void => {
    if (tags.has('review-state-revert')) return
    lastValid.current = acceptReviewEditorChange({ editor, state, lastValid: lastValid.current, onChange, onError, onLimitExceeded })
  }
  return <LexicalComposer initialConfig={initialConfig}><div className="overflow-hidden rounded-lg border border-border bg-card/30"><ReviewToolbar /><RichTextPlugin contentEditable={<ContentEditable aria-label="Review body" className="min-h-80 px-5 py-4 leading-7 outline-none md:min-h-[30rem]" />} ErrorBoundary={EditorBoundary} placeholder={<p className="pointer-events-none absolute px-5 py-4 text-muted-foreground">Share your full review…</p>} /><ReviewMediaEditingPlugin /><HistoryPlugin /><ListPlugin /><OnChangePlugin ignoreSelectionChange onChange={change} /></div></LexicalComposer>
}

/** Uses callback initialization only for truly empty serialized roots. */
const getEditorInitialState = (document: ReviewDocumentV1): InitialEditorStateType => document.editorState.root.children.length > 0
  ? JSON.stringify(document.editorState)
  : () => { $getRoot().append($createParagraphNode()) }

function EditorBoundary({ children }: { children: ReactNode }) { return children }

type ReviewEditorChange = {
  editor: Parameters<NonNullable<Parameters<typeof OnChangePlugin>[0]['onChange']>>[1]
  lastValid: ReviewDocumentV1
  onChange: (document: ReviewDocumentV1) => void
  onError: (error: Error) => void
  onLimitExceeded: (attemptedCount: number) => void
  state: EditorState
}

/** Accepts strict state or restores last valid state to keep editor and Preview equal. */
export const acceptReviewEditorChange = ({ editor, lastValid, onChange, onError, onLimitExceeded, state }: ReviewEditorChange): ReviewDocumentV1 => {
  const editorState = state.toJSON()
  const attemptedCount = getSerializedVisibleTextLength(editorState)
  if (attemptedCount > REVIEW_DOCUMENT_MAX_VISIBLE_TEXT) {
    onLimitExceeded(attemptedCount)
    restoreReviewEditorState(editor, lastValid)
    return lastValid
  }
  try {
    const next = parseReviewDocument({ version: 1, editorState })
    onChange(next)
    return next
  } catch (cause) {
    onError(cause instanceof Error ? cause : new Error('Review editor state is invalid.'))
    restoreReviewEditorState(editor, lastValid)
    return lastValid
  }
}

const restoreReviewEditorState = (editor: ReviewEditorChange['editor'], document: ReviewDocumentV1): void => editor.setEditorState(editor.parseEditorState(JSON.stringify(document.editorState)), { tag: 'review-state-revert' })

/** Counts attempted visible content before strict bounds reject it. */
const getSerializedVisibleTextLength = (value: unknown): number => {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + getSerializedVisibleTextLength(item), 0)
  if (typeof value !== 'object' || value === null) return 0
  return getSerializedNodeVisibleTextLength(value as Record<string, unknown>)
}

/** Counts one serialized node before descending into nested values. */
const getSerializedNodeVisibleTextLength = (node: Record<string, unknown>): number => {
  if (node.type === 'text' && typeof node.text === 'string') return node.text.length
  if (node.type === 'review-image' && typeof node.alt === 'string') return node.alt.length
  if (node.type === 'review-video' && typeof node.label === 'string') return node.label.length
  if ('children' in node) return getSerializedVisibleTextLength(node.children)
  return Object.values(node).reduce<number>((sum, item) => sum + getSerializedVisibleTextLength(item), 0)
}
