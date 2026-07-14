import { describe, expect, test } from 'vitest'

import {
  REVIEW_DOCUMENT_MAX_BYTES,
  REVIEW_DOCUMENT_MAX_DEPTH,
  REVIEW_DOCUMENT_MAX_MEDIA,
  REVIEW_DOCUMENT_MAX_NODES,
  REVIEW_DOCUMENT_MAX_VISIBLE_TEXT,
  REVIEW_SUMMARY_LIMIT,
  createReviewStats,
  parseReviewDocument,
  validateDraftReview,
  validatePublishedReview,
} from './review-document'
import { EXTERNAL_MEDIA_URL_MAX_LENGTH, getVideoProvider } from './external-media'

const text = (value: string, format = 0) => ({ detail: 0, format, mode: 'normal', style: '', text: value, type: 'text', version: 1 })
const paragraph = (children: unknown[]) => ({ children, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', type: 'paragraph', version: 1 })
const document = (children: unknown[]) => ({
  version: 1,
  editorState: { root: { children, direction: null, format: '', indent: 0, type: 'root', version: 1 } },
})

describe('review document validation', () => {
  test('accepts a full canonical Lexical allowlist document', () => {
    const body = document([
      { children: [text('Heading')], direction: null, format: '', indent: 0, type: 'heading', tag: 'h2', version: 1 },
      paragraph([text('Bold and italic', 3), { type: 'linebreak', version: 1 }, text('underlined', 8)]),
      { children: [text('Quoted')], direction: null, format: '', indent: 0, type: 'quote', version: 1 },
      { children: [{ children: [text('First')], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 1 }], direction: null, format: '', indent: 0, listType: 'number', start: 1, tag: 'ol', type: 'list', version: 1 },
      { children: [paragraph([text('Secret')])], direction: null, format: '', indent: 0, type: 'spoiler', version: 1 },
      { type: 'review-image', version: 1, url: 'https://images.example/frieren.jpg', alt: 'Frieren casting a spell' },
      { type: 'review-video', version: 1, url: 'https://youtu.be/example', provider: 'youtube', label: 'Official trailer' },
    ])

    expect(parseReviewDocument(body)).toEqual(body)
    expect(validatePublishedReview(body, 90, 'Excellent.').body).toEqual(body)
  })

  test('accepts unchecked Lexical list items without allowing checklist state', () => {
    const uncheckedList = document([
      { children: [{ checked: undefined, children: [text('First')], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 1 }], direction: null, format: '', indent: 0, listType: 'bullet', start: 1, tag: 'ul', type: 'list', version: 1 },
    ])

    expect(parseReviewDocument(uncheckedList)).toEqual(uncheckedList)
    expect(() => parseReviewDocument(document([
      { children: [{ checked: true, children: [text('Task')], direction: null, format: '', indent: 0, type: 'listitem', version: 1, value: 1 }], direction: null, format: '', indent: 0, listType: 'bullet', start: 1, tag: 'ul', type: 'list', version: 1 },
    ]))).toThrow()
  })

  test('allows empty drafts but publish requires real text, rating, and summary', () => {
    const empty = document([])
    const mediaOnly = document([{ type: 'review-image', version: 1, url: 'https://images.example/a.jpg', alt: 'Alt only' }])

    expect(validateDraftReview(empty, null, '')).toEqual({ body: empty, rating: null, summary: '' })
    expect(() => validatePublishedReview(empty, 50, 'Summary')).toThrow('real body text')
    expect(() => validatePublishedReview(mediaOnly, 50, 'Summary')).toThrow('real body text')
    expect(() => validatePublishedReview(document([paragraph([text('Body')])]), null, 'Summary')).toThrow('Rating')
    expect(() => validatePublishedReview(document([paragraph([text('Body')])]), 50, '   ')).toThrow('Summary')
  })

  test('rejects unknown fields and nodes, unsupported marks, and noncanonical text state', () => {
    expect(() => parseReviewDocument(document([paragraph([{ ...text('x'), html: '<b>x</b>' }])]))).toThrow()
    expect(() => parseReviewDocument(document([{ type: 'code', version: 1, children: [] }]))).toThrow()
    expect(() => parseReviewDocument(document([paragraph([text('code', 16)])]))).toThrow()
    expect(() => parseReviewDocument(document([paragraph([{ ...text('token'), mode: 'token' }])]))).toThrow()
    expect(() => parseReviewDocument(document([paragraph([{ ...text('styled'), style: 'color:red' }])]))).toThrow()
  })

  test('preserves canonical Lexical fields while rejecting alignment and indentation throughout', () => {
    expect(() => parseReviewDocument({ ...document([]), editorState: { root: { ...document([]).editorState.root, format: 'center' } } })).toThrow()
    expect(() => parseReviewDocument(document([{ ...paragraph([text('x')]), indent: 1 }]))).toThrow()
    expect(() => parseReviewDocument(document([{ children: [text('x')], direction: null, format: 'right', indent: 0, type: 'heading', tag: 'h2', version: 1 }]))).toThrow()
    expect(() => parseReviewDocument(document([{ children: [{ children: [text('x')], direction: null, format: '', indent: 1, type: 'listitem', value: 1, version: 1 }], direction: null, format: '', indent: 0, listType: 'bullet', start: 1, tag: 'ul', type: 'list', version: 1 }]))).toThrow()
  })

  test('rejects unsafe, credentialed, oversized, and provider-mismatched media URLs', () => {
    expect(() => parseReviewDocument(document([{ type: 'review-image', version: 1, url: 'http://images.example/a.jpg', alt: 'A' }]))).toThrow()
    expect(() => parseReviewDocument(document([{ type: 'review-image', version: 1, url: 'https://user:pass@images.example/a.jpg', alt: 'A' }]))).toThrow()
    expect(() => parseReviewDocument(document([{ type: 'review-image', version: 1, url: 'https://images.example/a.jpg', alt: '   ' }]))).toThrow()
    expect(() => parseReviewDocument(document([{ type: 'review-video', version: 1, url: 'https://youtu.be/x', provider: 'vimeo' }]))).toThrow()
    expect(() => parseReviewDocument(document([{ type: 'review-video', version: 1, url: `https://example.com/${'x'.repeat(EXTERNAL_MEDIA_URL_MAX_LENGTH)}`, provider: 'external' }]))).toThrow()
  })

  test('rejects nested spoilers and excessive media, depth, node count, visible text, or UTF-8 bytes', () => {
    const spoiler = { children: [paragraph([text('secret')])], direction: null, format: '', indent: 0, type: 'spoiler', version: 1 }
    expect(() => parseReviewDocument(document([{ ...spoiler, children: [spoiler] }]))).toThrow()
    expect(() => parseReviewDocument(document(Array.from({ length: REVIEW_DOCUMENT_MAX_MEDIA + 1 }, (_, index) => ({ type: 'review-image', version: 1, url: `https://images.example/${index}.jpg`, alt: 'A' }))))).toThrow()
    expect(() => parseReviewDocument(document([paragraph([text('x'.repeat(REVIEW_DOCUMENT_MAX_VISIBLE_TEXT + 1))])]))).toThrow()
    expect(() => parseReviewDocument(document(Array.from({ length: REVIEW_DOCUMENT_MAX_NODES }, () => paragraph([]))))).toThrow()

    let nested: unknown = text('deep')
    for (let index = 0; index < REVIEW_DOCUMENT_MAX_DEPTH; index += 1) nested = paragraph([nested])
    expect(() => parseReviewDocument(document([nested]))).toThrow()

    const oversizedBytes = document([paragraph([text('界'.repeat(Math.ceil(REVIEW_DOCUMENT_MAX_BYTES / 3)))])])
    expect(() => parseReviewDocument(oversizedBytes)).toThrow()
  })

  test('counts visible text from raw text, image alt, and explicit video label but excludes URLs', () => {
    const body = document([
      paragraph([text(' body ')]),
      { type: 'review-image', version: 1, url: 'https://images.example/long-url-is-not-visible.jpg', alt: 'alt' },
      { type: 'review-video', version: 1, url: 'https://video.example/long-url-is-not-visible', provider: 'external', label: 'label' },
    ])

    expect(validatePublishedReview(body, 50, 'Summary').visibleTextLength).toBe(14)
  })

  test('publish rejects invisible or control-only text and accepts legitimate Unicode', () => {
    for (const invisibleText of ['\u200B', '\u2060', '\uFEFF', '\u0000', ' \n\t']) {
      expect(() => validatePublishedReview(document([paragraph([text(invisibleText)])]), 50, 'Summary')).toThrow('real body text')
    }

    for (const unicodeText of ['葬送のフリーレン', 'مرحبا', '🧙🏽‍♀️']) {
      expect(validatePublishedReview(document([paragraph([text(unicodeText)])]), 50, 'Summary').body).toBeDefined()
    }
  })

  test('locks document and summary limits', () => {
    expect(REVIEW_DOCUMENT_MAX_VISIBLE_TEXT).toBe(2_500)
    expect(REVIEW_SUMMARY_LIMIT).toBe(280)
    expect(REVIEW_DOCUMENT_MAX_MEDIA).toBe(4)
    expect(REVIEW_DOCUMENT_MAX_DEPTH).toBe(8)
    expect(REVIEW_DOCUMENT_MAX_NODES).toBe(400)
    expect(REVIEW_DOCUMENT_MAX_BYTES).toBe(64 * 1024)
    expect(EXTERNAL_MEDIA_URL_MAX_LENGTH).toBe(2_048)
  })

  test('uses shared provider detection without changing Review behavior', () => {
    expect(getVideoProvider('https://youtu.be/example')).toBe('youtube')
    expect(() => parseReviewDocument(document([{ type: 'review-video', version: 1, url: 'https://youtu.be/example', provider: 'vimeo' }]))).toThrow('Video provider must match its URL.')
  })

  test('creates descending ten-band rating stats and rounds average to one decimal', () => {
    expect(createReviewStats([])).toEqual({ count: 0, average: null, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    expect(createReviewStats([100, 90, 89.9, 80, 9.9, 0])).toEqual({ count: 6, average: 61.6, bands: [2, 2, 0, 0, 0, 0, 0, 0, 0, 2] })
  })
})
