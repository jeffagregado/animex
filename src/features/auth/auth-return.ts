const UNAVAILABLE_MESSAGE = 'This content is unavailable.'

export type AuthReturnResult =
  | {
      available: true
      path: string
    }
  | {
      available: false
      message: typeof UNAVAILABLE_MESSAGE
    }

const unavailableResult = (): AuthReturnResult => ({
  available: false,
  message: UNAVAILABLE_MESSAGE,
})

// Validate a post-auth destination without changing its path, query, or hash.
export const resolveAuthReturnTo = (returnTo: string | null | undefined): AuthReturnResult => {
  if (returnTo === null || returnTo === undefined || returnTo === '') {
    return { available: true, path: '/home' }
  }
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return unavailableResult()
  }
  if (returnTo.includes('\\') || /%5c/i.test(returnTo)) {
    return unavailableResult()
  }

  let target: URL
  let decodedPath: string
  try {
    target = new URL(returnTo, 'https://animex.local')
    decodedPath = decodeURIComponent(target.pathname)
  } catch {
    return unavailableResult()
  }

  if (target.origin !== 'https://animex.local') {
    return unavailableResult()
  }
  if (decodedPath.includes('\\') || decodedPath.startsWith('//')) {
    return unavailableResult()
  }
  if (decodedPath === '/auth' || decodedPath.startsWith('/auth/')) {
    return unavailableResult()
  }

  return { available: true, path: returnTo }
}
