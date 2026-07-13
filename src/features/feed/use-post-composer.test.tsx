// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePostComposer } from './use-post-composer'

const mocks = vi.hoisted(() => ({
  index: 0,
  generate: vi.fn(), register: vi.fn(), discard: vi.fn(), create: vi.fn(), update: vi.fn(), process: vi.fn(),
}))
vi.mock('convex/react', () => ({ useMutation: () => [mocks.generate, mocks.register, mocks.discard, mocks.create, mocks.update][mocks.index++ % 5] }))
vi.mock('./process-post-image', () => ({ processPostImage: mocks.process }))

const initial = { text: '', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public' as const }
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (cause: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

beforeEach(() => {
  mocks.index = 0
  Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
  mocks.process.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/jpeg' }), mimeType: 'image/jpeg', size: 5, width: 10, height: 20 })
  mocks.generate.mockResolvedValue({ imageId: 'claim-image', uploadUrl: 'https://upload.test' })
  mocks.register.mockResolvedValue('registered-image')
  mocks.discard.mockResolvedValue(null)
  mocks.create.mockResolvedValue('post-1')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ storageId: 'storage-1' }) }) as Response))
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
})

describe('usePostComposer upload lifecycle', () => {
  it('registers exact metadata and submits images in reordered UI order', async () => {
    mocks.register.mockReset().mockResolvedValueOnce('registered-one').mockResolvedValueOnce('registered-two')
    const { result } = renderHook(() => usePostComposer(initial))
    await act(async () => { await result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })); await result.current.upload(new File(['b'], 'b.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(result.current.images.every((image) => image.status === 'ready')).toBe(true))
    act(() => result.current.move(1, -1))
    await act(async () => { result.current.setText('hello'); await result.current.submit(null) })
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/jpeg', size: 5, width: 10, height: 20 }))
    expect(mocks.create.mock.calls[0]?.[0].imageIds).toEqual(['registered-two', 'registered-one'])
  })

  it('waits for a late claim then discards it when close cancels processing', async () => {
    const claim = deferred<{ imageId: string; uploadUrl: string }>()
    mocks.generate.mockReturnValueOnce(claim.promise)
    const { result } = renderHook(() => usePostComposer(initial))
    let upload!: Promise<void>
    act(() => { upload = result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    let cleanup!: Promise<void>
    act(() => { cleanup = result.current.discardAll() })
    await act(async () => { claim.resolve({ imageId: 'late-claim', uploadUrl: 'https://upload.test' }); await upload; await cleanup })
    expect(mocks.discard).toHaveBeenCalledWith({ imageId: 'late-claim' })
    expect(result.current.images).toEqual([])
  })

  it('discards a late registered image without racing attached storage', async () => {
    const registration = deferred<string>()
    mocks.register.mockReturnValueOnce(registration.promise)
    const { result } = renderHook(() => usePostComposer(initial))
    let upload!: Promise<void>
    act(() => { upload = result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(mocks.register).toHaveBeenCalled())
    let cleanup!: Promise<void>
    act(() => { cleanup = result.current.discardAll() })
    await act(async () => { registration.resolve('late-registered'); await upload; await cleanup })
    expect(mocks.discard).toHaveBeenCalledWith({ imageId: 'late-registered' })
  })

  it('parses delayed upload JSON before cancellation cleanup', async () => {
    const json = deferred<{ storageId: string }>()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => json.promise } as Response)
    const { result } = renderHook(() => usePostComposer(initial))
    let upload!: Promise<void>
    act(() => { upload = result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    let cleanup!: Promise<void>
    act(() => { cleanup = result.current.discardAll() })
    await act(async () => { json.resolve({ storageId: 'late-storage' }); await upload; await cleanup })
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.discard).toHaveBeenCalledWith({ imageId: 'claim-image', storageId: 'late-storage' })
  })

  it('retries a rejected cleanup instead of caching its rejection', async () => {
    mocks.discard.mockRejectedValueOnce(new Error('cleanup offline')).mockResolvedValueOnce(null)
    const { result } = renderHook(() => usePostComposer(initial))
    await act(async () => { await result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await expect(result.current.remove(0)).rejects.toThrow('cleanup offline')
    await act(async () => { await result.current.remove(0) })
    expect(mocks.discard).toHaveBeenCalledTimes(2)
    expect(result.current.images).toEqual([])
  })

  it('cancels processing operations on unmount without updating state', async () => {
    const processing = deferred<{ blob: Blob; mimeType: string; size: number; width: number; height: number }>()
    mocks.process.mockReturnValueOnce(processing.promise)
    const { result, unmount } = renderHook(() => usePostComposer(initial))
    let upload!: Promise<void>
    act(() => { upload = result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(mocks.process).toHaveBeenCalled())
    unmount()
    processing.resolve({ blob: new Blob(['image']), mimeType: 'image/jpeg', size: 5, width: 10, height: 20 })
    await upload
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview'))
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('cancels uploading operations on unmount and deletes claimed storage', async () => {
    const response = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(response.promise)
    const { result, unmount } = renderHook(() => usePostComposer(initial))
    let upload!: Promise<void>
    act(() => { upload = result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    unmount()
    response.resolve({ ok: true, json: async () => ({ storageId: 'unmounted-storage' }) } as Response)
    await upload
    await waitFor(() => expect(mocks.discard).toHaveBeenCalledWith({ imageId: 'claim-image', storageId: 'unmounted-storage' }))
  })

  it('discards registered pending images on unmount', async () => {
    const { result, unmount } = renderHook(() => usePostComposer(initial))
    await act(async () => { await result.current.upload(new File(['a'], 'a.jpg', { type: 'image/jpeg' })) })
    expect(result.current.images[0]?.status).toBe('ready')
    unmount()
    await waitFor(() => expect(mocks.discard).toHaveBeenCalledWith({ imageId: 'registered-image' }))
  })

  it('blocks errored images until explicitly removed', async () => {
    mocks.process.mockRejectedValueOnce(new Error('decode failed'))
    const { result } = renderHook(() => usePostComposer(initial))
    await act(async () => { await result.current.upload(new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })) })
    expect(result.current.images[0]?.status).toBe('error')
    await expect(result.current.submit(null)).rejects.toThrow('Remove failed images')
    expect(mocks.create).not.toHaveBeenCalled()
    await act(async () => { await result.current.remove(0) })
    expect(result.current.images).toEqual([])
  })

  it('locks reorder/remove while edit submission is running', async () => {
    const update = deferred<string>()
    mocks.update.mockReturnValueOnce(update.promise)
    const edit = { text: 'Edit', imageIds: ['attached-image'], imageUrls: ['https://image.test/a.jpg'], hasSpoiler: false, visibility: 'private' as const }
    const { result } = renderHook(() => usePostComposer(edit))
    let submission!: Promise<void>
    act(() => { submission = result.current.submit('post-source') })
    await waitFor(() => expect(result.current.submitting).toBe(true))
    expect(() => result.current.move(0, 1)).toThrow('submission to finish')
    await expect(result.current.remove(0)).rejects.toThrow('submission to finish')
    await act(async () => { update.resolve('post-source'); await submission })
    expect(mocks.update.mock.calls[0]?.[0]).toMatchObject({ postId: 'post-source', imageIds: ['attached-image'] })
  })
})
