// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileImageCropper } from './profile-image-cropper'

const mocks = vi.hoisted(() => ({
  crop: vi.fn(),
  validate: vi.fn(),
  generate: vi.fn(),
  register: vi.fn(),
  finalize: vi.fn(),
  remove: vi.fn(),
  order: [] as string[],
  revoke: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  }
})

vi.mock('convex/server', () => ({
  makeFunctionReference: (_kind: string) => _kind,
}))

vi.mock('convex/react', () => ({
  useConvex: () => ({
    action: async (_ref: string, args: unknown) => {
      mocks.order.push('finalize')
      return await mocks.finalize(args)
    },
  }),
  useMutation: (ref: string) => {
    if (ref.includes('generateUploadUrl')) {
      return async (args: unknown) => {
        mocks.order.push('generate')
        return await mocks.generate(args)
      }
    }
    if (ref.includes('registerPending')) {
      return async (args: unknown) => {
        mocks.order.push('register')
        return await mocks.register(args)
      }
    }
    return async (args: unknown) => {
      mocks.order.push('remove')
      return await mocks.remove(args)
    }
  },
}))

vi.mock('./profile-media-canvas', () => ({
  cropProfileMedia: (...args: unknown[]) => mocks.crop(...args),
  validateProfileMediaSource: (...args: unknown[]) => mocks.validate(...args),
}))

vi.mock('react-easy-crop', async () => {
  const React = await import('react')
  return {
    default: (props: {
      aspect: number
      classes?: { cropAreaClassName?: string }
      crop: { x: number; y: number }
      cropShape: string
      cropperProps?: React.HTMLAttributes<HTMLDivElement>
      image: string
      mediaProps: { alt?: string }
      onCropChange: (point: { x: number; y: number }) => void
      restrictPosition: boolean
      roundCropAreaPixels: boolean
      onCropComplete: (area: object, pixels: object) => void
      onMediaLoaded: (size: object) => void
    }) => {
      React.useEffect(() => {
        props.onMediaLoaded({
          width: 100,
          height: 100,
          naturalWidth: 100,
          naturalHeight: 100,
        })
        props.onCropComplete(
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 1, y: 2, width: 50, height: 50 },
        )
      }, [])
      return (
        <>
          <img alt={props.mediaProps.alt} src={props.image} />
          <div
            {...props.cropperProps}
            className={props.classes?.cropAreaClassName}
            data-aspect={props.aspect}
            data-crop-shape={props.cropShape}
            data-crop-x={props.crop.x}
            data-image={props.image}
            data-restrict={String(props.restrictPosition)}
            data-rounded={String(props.roundCropAreaPixels)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') props.onCropChange({ x: 2, y: 0 })
            }}
          />
        </>
      )
    },
  }
})

const source = new File(['source'], 'source.png', { type: 'image/png' })

const renderCropper = (
  values: Partial<React.ComponentProps<typeof ProfileImageCropper>> = {},
) => render(
  <ProfileImageCropper
    active
    currentUrl={null}
    disabled={false}
    kind="avatar"
    onBusyChange={vi.fn()}
    {...values}
  />,
)

const choose = (): void => {
  fireEvent.change(screen.getByLabelText('Choose avatar image'), {
    target: { files: [source] },
  })
}

const applyAvatar = async (): Promise<void> => {
  const button = await screen.findByRole<HTMLButtonElement>('button', {
    name: 'Apply avatar crop',
  })
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((pass) => {
    resolve = pass
  })
  return { promise, resolve }
}

const drain = async <T,>(promise: Promise<T>): Promise<void> => {
  await promise
  await Promise.resolve()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  await Promise.resolve()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

beforeEach(() => {
  mocks.crop.mockReset()
  mocks.validate.mockReset()
  mocks.generate.mockReset()
  mocks.register.mockReset()
  mocks.finalize.mockReset()
  mocks.remove.mockReset()
  mocks.order.length = 0
  mocks.revoke.mockReset()
  mocks.validate.mockResolvedValue(undefined)
  mocks.crop.mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }))
  mocks.generate.mockResolvedValue('https://upload.test')
  mocks.register.mockResolvedValue(null)
  mocks.finalize.mockResolvedValue(null)
  mocks.remove.mockResolvedValue(null)
  mocks.invalidate.mockReset()
  mocks.invalidate.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn(async () => {
    mocks.order.push('post')
    return new Response(JSON.stringify({ storageId: 'storage-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }))
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:source'),
    revokeObjectURL: mocks.revoke,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProfileImageCropper', () => {
  it('configures an accessible controlled round avatar crop and keyboard zoom', async () => {
    renderCropper()
    choose()
    const cropper = await screen.findByLabelText('Pan avatar crop')
    expect(cropper.dataset.aspect).toBe('1')
    expect(cropper.dataset.cropShape).toBe('round')
    expect(cropper.dataset.restrict).toBe('true')
    expect(cropper.dataset.rounded).toBe('true')
    expect(cropper.getAttribute('aria-describedby')).toBe('avatar-crop-instructions')
    expect(cropper.className).toContain('focus-visible:ring-2')
    expect(screen.getByText(/arrow keys to pan/i)).toBeTruthy()
    expect(screen.getByAltText('Avatar crop source')).toBeTruthy()
    fireEvent.keyDown(cropper, { key: 'ArrowRight' })
    expect(cropper.tabIndex).toBe(0)
    await waitFor(() => expect(cropper.dataset.cropX).toBe('2'))
    expect(screen.getByRole('slider', { name: 'Zoom avatar' })).toBeTruthy()
  })

  it('uploads only cropped Blob in exact generate, POST, register, finalize order', async () => {
    renderCropper()
    choose()
    await applyAvatar()

    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledWith({
      kind: 'avatar',
      storageId: 'storage-1',
    }))
    expect(mocks.order).toEqual(['generate', 'post', 'register', 'finalize'])
    const request = vi.mocked(fetch).mock.calls[0]?.[1]
    expect(request?.body).toBeInstanceOf(Blob)
    expect(request?.body).not.toBeInstanceOf(File)
    expect(request?.headers).toEqual({ 'Content-Type': 'image/webp' })
  })

  it('cancel and replacement revoke URLs without network or Convex calls', async () => {
    renderCropper()
    choose()
    await screen.findByAltText('Avatar crop source')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel crop' }))
    expect(mocks.revoke).toHaveBeenCalledWith('blob:source')
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('remove calls only remove(kind)', async () => {
    renderCropper({ currentUrl: 'https://image.test/avatar.webp' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove avatar' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({
      kind: 'avatar',
    }))
    expect(mocks.order).toEqual(['remove'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes the authenticated server Profile query after successful finalize', async () => {
    renderCropper()
    choose()
    await applyAvatar()
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalled())
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['profile', 'server'],
    })
  })

  it('refreshes the authenticated server Profile query after successful removal', async () => {
    renderCropper({ currentUrl: 'https://image.test/avatar.webp' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove avatar' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalled())
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['profile', 'server'],
    })
  })

  it('shows strict upload failure and retries a fresh full sequence', async () => {
    mocks.generate
      .mockRejectedValueOnce(new Error('Profile media upload failed.'))
      .mockResolvedValueOnce('https://upload.test')
    renderCropper()
    choose()
    await applyAvatar()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Profile media upload failed.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry avatar' }))
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledWith({
      kind: 'avatar',
      storageId: 'storage-1',
    }))
    expect(mocks.generate).toHaveBeenCalledTimes(2)
  })

  it('rejects a successful upload response without strict storage JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    renderCropper()
    choose()
    await applyAvatar()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'invalid storage ID',
    )
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.finalize).not.toHaveBeenCalled()
  })

  it('stops after a pending upload URL resolves following unmount', async () => {
    const pending = deferred<string>()
    const onBusyChange = vi.fn()
    mocks.generate.mockReturnValue(pending.promise)
    const view = renderCropper({ onBusyChange })
    choose()
    await applyAvatar()
    await waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    view.unmount()
    const callsAtUnmount = [...onBusyChange.mock.calls]
    pending.resolve('https://upload.test')
    await drain(pending.promise)
    expect(onBusyChange.mock.calls).toEqual(callsAtUnmount)
    expect(mocks.revoke).toHaveBeenCalledWith('blob:source')
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.finalize).not.toHaveBeenCalled()
    expect(view.container.textContent).toBe('')
  })

  it('aborts a pending POST and never registers after unmount', async () => {
    const pending = deferred<Response>()
    const onBusyChange = vi.fn()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const view = renderCropper({ onBusyChange })
    choose()
    await applyAvatar()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal
    view.unmount()
    const callsAtUnmount = [...onBusyChange.mock.calls]
    expect(signal?.aborted).toBe(true)
    pending.resolve(new Response(JSON.stringify({
      storageId: 'storage-late',
    }), { status: 200 }))
    await drain(pending.promise)
    expect(onBusyChange.mock.calls).toEqual(callsAtUnmount)
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.finalize).not.toHaveBeenCalled()
    expect(view.container.textContent).toBe('')
  })

  it('never finalizes when pending registration resolves after unmount', async () => {
    const pending = deferred<null>()
    const onBusyChange = vi.fn()
    mocks.register.mockReturnValue(pending.promise)
    const view = renderCropper({ onBusyChange })
    choose()
    await applyAvatar()
    await waitFor(() => expect(mocks.register).toHaveBeenCalled())
    view.unmount()
    const callsAtUnmount = [...onBusyChange.mock.calls]
    pending.resolve(null)
    await drain(pending.promise)
    expect(onBusyChange.mock.calls).toEqual(callsAtUnmount)
    expect(mocks.finalize).not.toHaveBeenCalled()
    expect(view.container.textContent).toBe('')
  })
})
