import {
  $applyNodeReplacement,
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
} from 'lexical'

export type SerializedSpoilerNode = SerializedElementNode & { type: 'spoiler'; version: 1 }

/** Groups selected top-level blocks behind one independent spoiler cover. */
export class SpoilerNode extends ElementNode {
  static getType(): string { return 'spoiler' }
  static clone(node: SpoilerNode): SpoilerNode { return new SpoilerNode(node.__key) }
  static importJSON(node: SerializedSpoilerNode): SpoilerNode { return $createSpoilerNode().updateFromJSON(node) }

  constructor(key?: NodeKey) { super(key) }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('section')
    element.className = 'rounded-lg border border-cyan-400/60 bg-cyan-400/5 p-3'
    element.dataset.reviewSpoiler = 'true'
    return element
  }

  updateDOM(): boolean { return false }
  exportJSON(): SerializedSpoilerNode { return { ...super.exportJSON(), type: 'spoiler', version: 1 } }
  canBeEmpty(): boolean { return false }
  canInsertTextBefore(): boolean { return false }
  canInsertTextAfter(): boolean { return false }
}

export const $createSpoilerNode = (): SpoilerNode => $applyNodeReplacement(new SpoilerNode())
export const $isSpoilerNode = (node: LexicalNode | null | undefined): node is SpoilerNode => node instanceof SpoilerNode
