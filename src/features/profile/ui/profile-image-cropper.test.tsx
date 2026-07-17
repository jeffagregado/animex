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
}))

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
      cropShape: string
      image: string
      mediaProps: { alt?: string }
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
        <div
          aria-label={props.mediaProps.alt}
          data-aspect={props.aspect}
          data-crop-shape={props.cropShape}
          data-image={props.image}
          data-restrict={String(props.restrictPosition)}
          data-rounded={String(props.roundCropAreaPixels)}
        />
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
    const cropper = await screen.findByLabelText('Avatar crop source')
    expect(cropper.dataset.aspect).toBe('1')
    expect(cropper.dataset.cropShape).toBe('round')
    expect(cropper.dataset.restrict).toBe('true')
    expect(cropper.dataset.rounded).toBe('true')
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
    await screen.findByLabelText('Avatar crop source')
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

  it('revokes selection on unmount and ignores late completion UI writes', async () => {
    let resolve!: (value: string) => void
    mocks.generate.mockReturnValue(new Promise<string>((pass) => {
      resolve = pass
    }))
    const view = renderCropper()
    choose()
    await applyAvatar()
    await waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    view.unmount()
    resolve('https://upload.test')
    await Promise.resolve()
    expect(mocks.revoke).toHaveBeenCalledWith('blob:source')
    expect(mocks.register).not.toHaveBeenCalled()
  })
})
