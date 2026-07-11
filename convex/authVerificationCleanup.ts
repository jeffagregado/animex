export const AUTH_VERIFICATION_BATCH_LIMIT = 20

type VerificationBatch = {
  hasMore: boolean
  identifiers: string[]
}

type VerificationCleanupDependencies = {
  listByAuthId: (authId: string, limit: number) => Promise<VerificationBatch>
  remove: (identifier: string) => Promise<void>
}

const getEmailOtpIdentifiers = (email: string): string[] => [
  `email-verification-otp-${email}`,
  `sign-in-otp-${email}`,
  `forget-password-otp-${email}`,
]

export const deleteAuthVerificationRows = async (
  dependencies: VerificationCleanupDependencies,
  authId: string,
  email: string,
): Promise<void> => {
  const batch = await dependencies.listByAuthId(authId, AUTH_VERIFICATION_BATCH_LIMIT)
  const identifiers = [...new Set([
    ...batch.identifiers,
    ...getEmailOtpIdentifiers(email.trim().toLowerCase()),
  ])]
  for (const identifier of identifiers) await dependencies.remove(identifier)
  if (batch.hasMore) {
    throw new Error('Auth verification cleanup bounded batch exhausted; retry required.')
  }
}
