import { describe, expect, test } from 'vitest'

import { AniListRequestError, requestAniList, requestAniListAllowingNotFound, type AniListDependencies } from './anilist-client.server'

const dependencies = (responses: Response[]): AniListDependencies => ({
  fetch: async () => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request.')
    return response
  },
  delay: async () => {},
  warn: () => {},
  now: () => 0,
})

describe('AniList client', () => {
  test('sanitizes malformed JSON as an upstream error', async () => {
    await expect(requestAniList('query Test { Viewer { id } }', {}, dependencies([
      new Response('{bad', { status: 200 }),
    ]))).rejects.toEqual(expect.objectContaining({
      name: 'AniListRequestError',
      code: 'UPSTREAM',
      message: 'AniList is temporarily unavailable.',
    }))
  })

  test('exposes only sanitized rate-limit details', async () => {
    await expect(requestAniList('query Test { Viewer { id } }', {}, dependencies([
      new Response('secret', { status: 429, headers: { 'retry-after': '12' } }),
    ]))).rejects.toBeInstanceOf(AniListRequestError)
  })

  test('does not retry a rate limit without a Retry-After value', async () => {
    await expect(requestAniList('query Test { Viewer { id } }', {}, dependencies([
      new Response('limited', { status: 429 }),
    ]))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: null,
    })
  })

  test('keeps generic Discover requests strict on HTTP 404', async () => {
    await expect(requestAniList('query Test { Media { id } }', {}, dependencies([
      new Response(JSON.stringify({ data: { Media: null } }), { status: 404 }),
    ]))).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('retries server errors with bounded linear delays', async () => {
    const delays: number[] = []
    const warnings: string[] = []
    const deps = dependencies([
      new Response('unavailable', { status: 500 }),
      new Response('unavailable', { status: 503 }),
      Response.json({ data: { Viewer: { id: 1 } } }),
    ])
    deps.delay = async (milliseconds) => { delays.push(milliseconds) }
    deps.warn = (message) => { warnings.push(message) }

    await expect(requestAniList('query Test { Viewer { id } }', {}, deps)).resolves.toEqual({ data: { Viewer: { id: 1 } } })
    expect(delays).toEqual([200, 400])
    expect(warnings).toEqual([
      'AniList request retry 1 of 2.',
      'AniList request retry 2 of 2.',
    ])
  })

  test('retries a short rate limit before returning the response', async () => {
    const delays: number[] = []
    const deps = dependencies([
      new Response('limited', { status: 429, headers: { 'retry-after': '2' } }),
      Response.json({ data: { Viewer: { id: 1 } } }),
    ])
    deps.delay = async (milliseconds) => { delays.push(milliseconds) }

    await expect(requestAniList('query Test { Viewer { id } }', {}, deps)).resolves.toEqual({ data: { Viewer: { id: 1 } } })
    expect(delays).toEqual([2_000])
  })

  test('returns a sanitized error after timeout retries are exhausted', async () => {
    let attempts = 0
    const deps = dependencies([])
    deps.fetch = async () => {
      attempts += 1
      throw new DOMException('request timed out with secret context', 'TimeoutError')
    }

    await expect(requestAniList('query Test { Viewer { id } }', {}, deps)).rejects.toMatchObject({
      code: 'UPSTREAM',
      message: 'AniList is temporarily unavailable.',
    })
    expect(attempts).toBe(3)
  })

  test.each(['Media', 'Character', 'Staff'] as const)(
    'allows only strict validated %s not-found response shapes',
    async (root) => {
      const body = { errors: [{ message: 'Not Found.', status: 404 }], data: { [root]: null } }

      await expect(requestAniListAllowingNotFound('query Test { Root { id } }', {}, dependencies([
        Response.json(body, { status: 404 }),
      ]), root)).resolves.toEqual(body)

      await expect(requestAniListAllowingNotFound('query Test { Root { id } }', {}, dependencies([
        Response.json({ ...body, data: { Wrong: null } }, { status: 404 }),
      ]), root)).rejects.toMatchObject({ code: 'UPSTREAM' })

      await expect(requestAniListAllowingNotFound('query Test { Root { id } }', {}, dependencies([
        Response.json({ ...body, data: { [root]: null, Extra: null } }, { status: 404 }),
      ]), root)).rejects.toMatchObject({ code: 'UPSTREAM' })
    },
  )

  test('rejects incomplete not-found bodies', async () => {
    await expect(requestAniListAllowingNotFound('query Test { Media { id } }', {}, dependencies([
      Response.json({ data: { Media: null } }, { status: 404 }),
    ]), 'Media')).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('sanitizes GraphQL error response details', async () => {
    await expect(requestAniList('query Test { Viewer { id } }', {}, dependencies([
      Response.json({ errors: [{ message: 'secret resolver detail' }] }),
    ]))).rejects.toMatchObject({
      code: 'UPSTREAM',
      message: 'AniList is temporarily unavailable.',
    })
  })
})
