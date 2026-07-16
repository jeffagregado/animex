import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getRootHead } from './__root'

const publicAsset = (name: string): string => resolve(process.cwd(), 'public', name)

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
  })
})
