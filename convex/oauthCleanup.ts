export const CLEANUP_BATCH_LIMIT = 20
export const CLEANUP_LEASE_MS = 5 * 60 * 1000

type CleanupState = {
  accountExists: boolean
  cleanupAfter: number
  hasActiveSession: boolean
  hasProfile: boolean
  providerId: string
}

export const canCleanupPending = (state: CleanupState, now: number): boolean =>
  state.providerId === 'google' &&
  state.cleanupAfter <= now &&
  !state.hasProfile &&
  !state.hasActiveSession &&
  state.accountExists

export const canCleanupProvisional = (
  state: {
    cleanupAfter: number
    hasAccount: boolean
    hasActiveSession: boolean
    hasProfile: boolean
  },
  now: number,
): boolean => state.cleanupAfter <= now &&
  !state.hasAccount &&
  !state.hasActiveSession &&
  !state.hasProfile

export const acquireCleanupLease = (
  pending: { cleanupLeaseUntil?: number },
  now: number,
  leaseUntil: number,
) => pending.cleanupLeaseUntil && pending.cleanupLeaseUntil > now
  ? { acquired: false, cleanupLeaseUntil: pending.cleanupLeaseUntil }
  : { acquired: true, cleanupLeaseUntil: leaseUntil }

export const releaseCleanupLease = (
  pending: { cleanupLeaseUntil?: number },
  expectedLeaseUntil: number,
): boolean => pending.cleanupLeaseUntil === expectedLeaseUntil

type PendingCleanup = {
  cleanupAfter: number
  cleanupPhase?: 'deleting'
  providerId?: string | null
  state: 'oauth' | 'provisional'
}

type CleanupInspection = {
  accountExists: boolean
  hasAccount: boolean
  hasActiveSession: boolean
  hasProfile: boolean
}

type CleanupDependencies = {
  deleteAuth: () => Promise<void>
  deleteVerifications: () => Promise<void>
  finish: () => Promise<void>
  inspect: () => Promise<CleanupInspection>
  markDeleting: () => Promise<void>
  releaseLease: () => Promise<void>
}

export const cleanupPendingIdentity = async (
  pending: PendingCleanup,
  now: number,
  dependencies: CleanupDependencies,
): Promise<'deleted' | 'skipped'> => {
  const inspection = await dependencies.inspect()
  if (pending.cleanupPhase === 'deleting') {
    if (inspection.hasProfile || inspection.hasActiveSession) {
      throw new Error('OAuth cleanup retry refused: identity became active.')
    }
  } else {
    const eligible = pending.state === 'provisional'
      ? canCleanupProvisional({
          cleanupAfter: pending.cleanupAfter,
          hasAccount: inspection.hasAccount,
          hasActiveSession: inspection.hasActiveSession,
          hasProfile: inspection.hasProfile,
        }, now)
      : canCleanupPending({
          accountExists: inspection.accountExists,
          cleanupAfter: pending.cleanupAfter,
          hasActiveSession: inspection.hasActiveSession,
          hasProfile: inspection.hasProfile,
          providerId: pending.providerId ?? '',
        }, now)
    if (!eligible) {
      await dependencies.releaseLease()
      return 'skipped'
    }
    await dependencies.markDeleting()
  }

  await dependencies.deleteVerifications()
  await dependencies.deleteAuth()
  await dependencies.finish()
  return 'deleted'
}

export const selectCleanupBatch = <Row extends { cleanupAfter: number }>(
  rows: Row[],
  now: number,
  limit: number,
): Row[] => rows
  .filter((row) => row.cleanupAfter <= now)
  .sort((left, right) => left.cleanupAfter - right.cleanupAfter)
  .slice(0, Math.min(limit, CLEANUP_BATCH_LIMIT))
