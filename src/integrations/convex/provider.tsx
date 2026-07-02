import { ConvexProvider } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { AuthClient } from '@convex-dev/better-auth/react'

import { authClient } from '../../lib/auth-client'

const requireClientEnv = (name: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX client startup.`)
  }
  return value
}

const CONVEX_URL = requireClientEnv('VITE_CONVEX_URL')
const convexQueryClient = new ConvexQueryClient(CONVEX_URL)
const convexAuthClient = authClient as unknown as AuthClient

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProvider client={convexQueryClient.convexClient}>
      <ConvexBetterAuthProvider
        client={convexQueryClient.convexClient}
        authClient={convexAuthClient}
      >
        {children}
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  )
}
