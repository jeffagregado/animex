const DAY_MS = 24 * 60 * 60 * 1000

export const GOOGLE_OAUTH_ERROR = "Google sign-in couldn’t continue. Try another sign-in method."

type AuthUserSeed = { email: string; emailVerified: boolean }
type AccountSeed = { accountId: string; providerId: string; userId: string }
type UserSeed = { email: string; name: string }
type AuthEndpointSeed = {
  body?: { idToken?: unknown; provider?: unknown }
  params?: { id?: unknown }
  path: string
}

export const assertAuthUserCreationAllowed = (endpoint: AuthEndpointSeed, user: AuthUserSeed): void => {
  const isCallback = endpoint.path === '/callback/:id' && endpoint.params?.id === 'google'
  const isIdToken = endpoint.path === '/sign-in/social' &&
    endpoint.body?.provider === 'google' && Boolean(endpoint.body.idToken)
  if (!isCallback && !isIdToken) return
  if (!user.email.trim() || user.emailVerified !== true) throw new Error(GOOGLE_OAUTH_ERROR)
}

const suggestUsername = (name: string): string | undefined => {
  const value = name.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').slice(0, 30)
  return value.length >= 3 ? value : undefined
}

export const buildPendingOauthSignup = (
  account: AccountSeed,
  user: UserSeed,
  now: number,
) => ({
  authId: account.userId,
  cleanupAfter: now + DAY_MS,
  createdAt: now,
  email: user.email.trim().toLowerCase(),
  providerAccountId: account.accountId,
  providerId: account.providerId,
  suggestedUsername: suggestUsername(user.name),
  updatedAt: now,
})

export const buildProvisionalIdentity = (
  user: { email: string; id: string; name: string },
  now: number,
) => ({
  authId: user.id,
  cleanupAfter: now + DAY_MS,
  createdAt: now,
  email: user.email.trim().toLowerCase(),
  state: 'provisional' as const,
  suggestedUsername: suggestUsername(user.name),
  updatedAt: now,
})

export const applyAccountToProvisional = (
  provisional: ReturnType<typeof buildProvisionalIdentity>,
  account: AccountSeed,
  now: number,
) => account.providerId !== 'google'
  ? null
  : {
      ...provisional,
      cleanupAfter: now + DAY_MS,
      providerAccountId: account.accountId,
      providerId: account.providerId,
      state: 'oauth' as const,
      updatedAt: now,
    }

export const advancePendingSession = (
  pending: { cleanupLeaseUntil?: number; cleanupPhase?: 'deleting' },
  now: number,
  expiresAt: number,
) => ({
  allowed: pending.cleanupPhase !== 'deleting' &&
    !(pending.cleanupLeaseUntil && pending.cleanupLeaseUntil > now),
  cleanupAfter: expiresAt + DAY_MS,
  lastSessionExpiresAt: expiresAt,
  updatedAt: now,
})

export const completePendingProfile = async <Id>({
  insert,
  removePending,
}: {
  insert: () => Promise<Id>
  removePending: () => Promise<void>
}): Promise<Id> => {
  const id = await insert()
  await removePending()
  return id
}
