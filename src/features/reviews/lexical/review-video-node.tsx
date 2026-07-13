import { $applyNodeReplacement, DecoratorNode, type EditorConfig, type NodeKey, type SerializedLexicalNode } from 'lexical'
import { ExternalLinkIcon, PlayIcon } from 'lucide-react'
import type { JSX } from 'react'

import type { VideoProvider } from '#/features/social/shared/review-document'

export type SerializedReviewVideoNode = SerializedLexicalNode & { label?: string; provider: VideoProvider; type: 'review-video'; url: string; version: 1 }

/** Stores one safe linked video preview; playback and iframes stay unsupported. */
export class ReviewVideoNode extends DecoratorNode<JSX.Element> {
  __label?: string
  __provider: VideoProvider
  __url: string

  static getType(): string { return 'review-video' }
  static clone(node: ReviewVideoNode): ReviewVideoNode { return new ReviewVideoNode(node.__url, node.__provider, node.__label, node.__key) }
  static importJSON(node: SerializedReviewVideoNode): ReviewVideoNode { return $createReviewVideoNode(node.url, node.provider, node.label) }

  constructor(url: string, provider: VideoProvider, label: string | undefined, key?: NodeKey) {
    super(key)
    this.__url = url
    this.__provider = provider
    this.__label = label
  }

  createDOM(_config: EditorConfig): HTMLElement { const element = document.createElement('div'); element.className = 'my-3'; return element }
  updateDOM(): boolean { return false }
  isInline(): boolean { return false }
  exportJSON(): SerializedReviewVideoNode { return { ...super.exportJSON(), ...(this.__label ? { label: this.__label } : {}), provider: this.__provider, type: 'review-video', url: this.__url, version: 1 } }
  decorate(): JSX.Element { return <a className="flex min-h-24 items-center gap-3 rounded-lg border border-border bg-card p-4 text-cyan-300" href={this.__url} rel="noreferrer noopener" target="_blank"><PlayIcon className="size-8" /><span className="flex-1 text-foreground">{this.__label ?? `Open ${this.__provider} video`}</span><ExternalLinkIcon className="size-5" /></a> }
}

export const $createReviewVideoNode = (url: string, provider: VideoProvider, label: string | undefined): ReviewVideoNode => $applyNodeReplacement(new ReviewVideoNode(url, provider, label))
