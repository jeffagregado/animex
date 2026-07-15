// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { ReviewPreview } from './review-preview'

const fields = { direction: null, format: '' as const, indent: 0 as const, version: 1 as const }
const document: ReviewDocumentV1 = { version: 1, editorState: { root: { ...fields, type: 'root', children: [{ ...fields, children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Published body', type: 'text', version: 1 }], textFormat: 0, textStyle: '', type: 'paragraph' }] } } }

afterEach(cleanup)

describe('ReviewPreview', () => {
  it('matches published summary spoiler and document behavior', () => {
    render(<ReviewPreview document={document} rating={92} summary="Ending revealed" containsSpoiler />)
    expect(screen.getByText('Published body')).toBeTruthy()
    expect(screen.queryByText('Ending revealed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal summary spoiler' }))
    expect(screen.getByText('Ending revealed')).toBeTruthy()
    expect(screen.getByText('92.0')).toBeTruthy()
  })

  it('renders validated structured media without HTML injection', () => {
    const mediaDocument: ReviewDocumentV1 = { version: 1, editorState: { root: { ...fields, type: 'root', children: [
      { alt: 'Frieren sunset', type: 'review-image', url: 'https://images.example/frieren.jpg', version: 1 },
      { label: 'Trailer', provider: 'youtube', type: 'review-video', url: 'https://youtu.be/dQw4w9WgXcQ', version: 1 },
    ] } } }
    const { container } = render(<ReviewPreview document={mediaDocument} rating={80} summary="Media review" containsSpoiler={false} />)
    expect(screen.getByAltText('Frieren sunset')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Trailer/ }).getAttribute('rel')).toBe('noreferrer noopener')
    expect(container.querySelector('[dangerouslySetInnerHTML]')).toBeNull()
  })
})
