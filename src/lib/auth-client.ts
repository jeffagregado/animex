import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

const getAuthBaseUrl = (): string => {
  const siteUrl = (import.meta.env as Record<string, string | undefined>).VITE_SITE_URL
  if (!siteUrl) {
    throw new Error('VITE_SITE_URL is required for AnimeX auth client.')
  }
  return `${siteUrl.replace(/\/$/, '')}/api/auth`
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  plugins: [convexClient(), emailOTPClient()],
})
