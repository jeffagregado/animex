import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

const requireServerEnv = (name: string, scope: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for ${scope}.`)
  }
  return value
}

export const getAuthProxy = (scope: string) => {
  return convexBetterAuthReactStart({
    convexUrl: requireServerEnv('VITE_CONVEX_URL', scope),
    convexSiteUrl: requireServerEnv('CONVEX_SITE_URL', scope),
  })
}
