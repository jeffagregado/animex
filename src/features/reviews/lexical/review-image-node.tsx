import { $applyNodeReplacement, DecoratorNode, type EditorConfig, type NodeKey, type SerializedLexicalNode } from 'lexical'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import type { JSX } from 'react'

function ReviewImage({ alt, nodeKey, url }: { alt: string; nodeKey: NodeKey; url: string }) {
  const [isSelected] = useLexicalNodeSelection(nodeKey)
  return <div className={isSelected ? 'rounded-lg ring-2 ring-cyan-300' : 'rounded-lg'} data-review-media><img alt={alt} className="aspect-video w-full rounded-lg border border-border object-cover" src={url} /></div>
}

export type SerializedReviewImageNode = SerializedLexicalNode & { alt: string; type: 'review-image'; url: string; version: 1 }

/** Stores one validated linked image block without HTML conversion. */
export class ReviewImageNode extends DecoratorNode<JSX.Element> {
  __alt: string
  __url: string

  static getType(): string { return 'review-image' }
  static clone(node: ReviewImageNode): ReviewImageNode { return new ReviewImageNode(node.__url, node.__alt, node.__key) }
  static importJSON(node: SerializedReviewImageNode): ReviewImageNode { return $createReviewImageNode(node.url, node.alt) }

  constructor(url: string, alt: string, key?: NodeKey) {
    super(key)
    this.__url = url
    this.__alt = alt
  }

  createDOM(_config: EditorConfig): HTMLElement { const element = document.createElement('div'); element.className = 'my-3'; return element }
  updateDOM(): boolean { return false }
  isInline(): boolean { return false }
  exportJSON(): SerializedReviewImageNode { return { ...super.exportJSON(), alt: this.__alt, type: 'review-image', url: this.__url, version: 1 } }
  decorate(): JSX.Element { return <ReviewImage alt={this.__alt} nodeKey={this.__key} url={this.__url} /> }
}

export const $createReviewImageNode = (url: string, alt: string): ReviewImageNode => $applyNodeReplacement(new ReviewImageNode(url, alt))
