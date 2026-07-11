import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

describe('auth route generation', () => {
  test('removes obsolete reset-token check source and generated route', () => {
    expect(existsSync(resolve('src/routes/api/profile/check-reset-token.ts'))).toBe(false)
    const routeTree = readFileSync(resolve('src/routeTree.gen.ts'), 'utf8')
    expect(routeTree).not.toContain('check-reset-token')
  })

  test('uses direct typed TanStack server routes without the generic cast helper', () => {
    expect(existsSync(resolve('src/lib/server-route.ts'))).toBe(false)

    const routeFiles = [
      'src/routes/api/auth/$.ts',
      'src/routes/api/profile/check-username.ts',
      'src/routes/api/profile/complete.ts',
      'src/routes/api/profile/state.ts',
    ]

    for (const routeFile of routeFiles) {
      const source = readFileSync(resolve(routeFile), 'utf8')
      expect(source).toContain('createFileRoute(')
      expect(source).not.toContain('createStartServerRoute')
      expect(source).not.toContain('as unknown as RouteOptions')
    }
  })
})
