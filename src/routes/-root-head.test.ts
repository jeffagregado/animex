import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getRootHead } from './__root'

interface IconSize {
  width: number
  height: number
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const publicAsset = (name: string): string => resolve(process.cwd(), 'public', name)

/** Reads and validates a PNG's signature and IHDR dimensions. */
const readPngSize = (name: string): IconSize => {
  const bytes = readFileSync(publicAsset(name))

  expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  expect(bytes.toString('ascii', 12, 16)).toBe('IHDR')

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

/** Reads and validates every ICO directory size. */
const readIcoSizes = (name: string): IconSize[] => {
  const bytes = readFileSync(publicAsset(name))
  const count = bytes.readUInt16LE(4)

  expect(bytes.readUInt16LE(0)).toBe(0)
  expect(bytes.readUInt16LE(2)).toBe(1)
  expect(count).toBe(4)
  expect(bytes.length).toBeGreaterThanOrEqual(6 + count * 16)

  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16
    const width = bytes.readUInt8(offset)
    const height = bytes.readUInt8(offset + 1)

    return {
      width: width === 0 ? 256 : width,
      height: height === 0 ? 256 : height,
    }
  })
}

describe('Shared AnimeX head', () => {
  it('links the global favicon and manifest set', () => {
    const head = getRootHead()

    expect(head.meta).toContainEqual({ name: 'theme-color', content: '#071522' })
    expect(head.links).toEqual(expect.arrayContaining([
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '16x16 32x32 48x48 64x64',
        type: 'image/x-icon',
      },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      { rel: 'manifest', href: '/manifest.json' },
    ]))
  })

  it('publishes AnimeX manifest values and every referenced asset', () => {
    const manifest: unknown = JSON.parse(readFileSync(publicAsset('manifest.json'), 'utf8'))

    expect(manifest).toEqual({
      short_name: 'AnimeX',
      name: 'AnimeX',
      icons: [
        {
          src: '/icon-192.png',
          type: 'image/png',
          sizes: '192x192',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          type: 'image/png',
          sizes: '512x512',
          purpose: 'any maskable',
        },
      ],
      start_url: '/',
      display: 'standalone',
      theme_color: '#071522',
      background_color: '#071522',
    })

    for (const name of [
      'favicon.svg',
      'favicon.ico',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
    ]) {
      expect(existsSync(publicAsset(name)), `${name} must exist`).toBe(true)
    }

    expect(existsSync(publicAsset('logo192.png'))).toBe(false)
    expect(existsSync(publicAsset('logo512.png'))).toBe(false)
  })

  it('publishes structurally valid PNG and ICO dimensions', () => {
    expect(readPngSize('apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
    expect(readPngSize('icon-192.png')).toEqual({ width: 192, height: 192 })
    expect(readPngSize('icon-512.png')).toEqual({ width: 512, height: 512 })
    expect(readIcoSizes('favicon.ico')).toEqual([
      { width: 16, height: 16 },
      { width: 32, height: 32 },
      { width: 48, height: 48 },
      { width: 64, height: 64 },
    ])
  })

  it('keeps the exact AnimeX mark on a full-bleed maskable background', () => {
    const svg = readFileSync(publicAsset('favicon.svg'), 'utf8')

    expect(svg).toContain('<rect width="160" height="160" fill="#071522" />')
    expect(svg).toContain('<g transform="translate(16 16) scale(0.8)">')
    expect(svg).toContain('d="M30 118 68 36l44 83-29-25-21 37 4-38-35 25Z"')
    expect(svg).toContain('d="M72 128 108 75 91 54l39-16-28 38 35 47h-27L88 95l-16 33Z"')
  })
})
