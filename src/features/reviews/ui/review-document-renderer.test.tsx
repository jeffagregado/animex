// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewDocumentRenderer } from './review-document-renderer'

const text = (value: string, format = 0) => ({ detail: 0 as const, format, mode: 'normal' as const, style: '' as const, text: value, type: 'text' as const, version: 1 as const })
const fields = { direction: null, format: '' as const, indent: 0 as const, version: 1 as const }
const paragraph = (value: string, format = 0) => ({ ...fields, children: [text(value, format)], textFormat: 0, textStyle: '' as const, type: 'paragraph' as const })
const document: ReviewDocumentV1 = {
  version: 1,
  editorState: { root: { ...fields, type: 'root', children: [
    { ...fields, children: [text('Heading')], tag: 'h2', type: 'heading' },
    paragraph('Bold italic underline strike', 15),
    { ...fields, children: [{ ...fields, children: [text('First')], type: 'listitem', value: 1 }], listType: 'bullet', start: 1, tag: 'ul', type: 'list' },
    { ...fields, children: [paragraph('Secret one')], type: 'spoiler' },
    { ...fields, children: [paragraph('Secret two')], type: 'spoiler' },
    { type: 'review-image', version: 1, url: 'https://images.example/frieren.jpg', alt: 'Frieren sunset' },
    { type: 'review-video', version: 1, url: 'https://youtu.be/dQw4w9WgXcQ', provider: 'youtube', label: 'Official trailer' },
  ] } },
}

afterEach(cleanup)

describe('ReviewDocumentRenderer', () => {
  it('renders semantic blocks and allowed text formats without HTML injection', () => {
    const { container } = render(<ReviewDocumentRenderer document={document} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Heading' })).toBeTruthy()
    const marked = screen.getByText('Bold italic underline strike')
    expect(container.querySelector('strong em s u')).toBe(marked)
    expect(screen.getByRole('list').tagName).toBe('UL')
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('maps Lexical underline and strikethrough bits to matching elements', () => {
    const formatted: ReviewDocumentV1 = {
      version: 1,
      editorState: { root: { ...fields, type: 'root', children: [paragraph('Underlined', 8), paragraph('Struck', 4)] } },
    }

    render(<ReviewDocumentRenderer document={formatted} />)
    expect(screen.getByText('Underlined').tagName).toBe('U')
    expect(screen.getByText('Struck').tagName).toBe('S')
  })

  it('reveals spoilers independently and preserves covered preview state', () => {
    render(<ReviewDocumentRenderer document={document} />)
    const reveals = screen.getAllByRole('button', { name: 'Reveal spoiler' })
    expect(screen.queryByText('Secret one')).toBeNull()
    fireEvent.click(reveals[0])
    expect(screen.getByText('Secret one')).toBeTruthy()
    expect(screen.queryByText('Secret two')).toBeNull()
  })

  it('uses safe linked video cards and explicit image failure state', () => {
    render(<ReviewDocumentRenderer document={document} />)
    const link = screen.getByRole('link', { name: /Official trailer/ })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer noopener')
    expect(screen.getByAltText('Frieren sunset')).toBeTruthy()
    fireEvent.error(screen.getByAltText('Frieren sunset'))
    expect(screen.getByText('Image unavailable')).toBeTruthy()
  })
})
