import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $createParagraphNode, $getRoot, type EditorState, type InitialEditorStateType } from 'lexical'
import type { ReactNode } from 'react'

import { parseReviewDocument, type ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewImageNode } from '../lexical/review-image-node'
import { SpoilerNode } from '../lexical/spoiler-node'
import { ReviewVideoNode } from '../lexical/review-video-node'
import { ReviewToolbar } from './review-toolbar'

type ReviewEditorProps = {
  document: ReviewDocumentV1
  onChange: (document: ReviewDocumentV1) => void
  onError: (error: Error) => void
}

const theme = {
  heading: { h2: 'mb-2 mt-4 text-2xl font-black', h3: 'mb-2 mt-4 text-xl font-black' },
  list: { listitem: 'ml-6', nested: { listitem: 'list-none' }, ol: 'list-decimal', ul: 'list-disc marker:text-cyan-300' },
  paragraph: 'mb-4',
  quote: 'border-l-2 border-cyan-300 pl-4 italic text-muted-foreground',
  text: { bold: 'font-bold', italic: 'italic', strikethrough: 'line-through', underline: 'underline' },
}

/** Owns locked Lexical node registration and JSON-only change output. */
export function ReviewEditor({ document, onChange, onError }: ReviewEditorProps) {
  const initialConfig = {
    editorState: getEditorInitialState(document),
    namespace: 'AnimeXReviewEditor',
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, SpoilerNode, ReviewImageNode, ReviewVideoNode],
    onError,
    theme,
  }
  const change = (state: EditorState): void => {
    try { onChange(parseReviewDocument({ version: 1, editorState: state.toJSON() })) }
    catch (cause) { onError(cause instanceof Error ? cause : new Error('Review editor state is invalid.')) }
  }
  return <LexicalComposer initialConfig={initialConfig}><div className="overflow-hidden rounded-lg border border-border bg-card/30"><ReviewToolbar /><RichTextPlugin contentEditable={<ContentEditable aria-label="Review body" className="min-h-80 px-5 py-4 leading-7 outline-none md:min-h-[30rem]" />} ErrorBoundary={EditorBoundary} placeholder={<p className="pointer-events-none absolute px-5 py-4 text-muted-foreground">Share your full review…</p>} /><HistoryPlugin /><ListPlugin /><OnChangePlugin ignoreSelectionChange onChange={change} /></div></LexicalComposer>
}

/** Uses callback initialization only for truly empty serialized roots. */
export const getEditorInitialState = (document: ReviewDocumentV1): InitialEditorStateType => document.editorState.root.children.length > 0
  ? JSON.stringify(document.editorState)
  : () => { $getRoot().append($createParagraphNode()) }

function EditorBoundary({ children }: { children: ReactNode }) { return children }
