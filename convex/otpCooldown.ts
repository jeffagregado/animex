export type OtpCooldownValue = {
  claimId: string
  nextAllowedAt: number
  updatedAt: number
}

const CLAIM_RESERVATION_MS = 5 * 60 * 1000
const SUCCESS_COOLDOWN_MS = 60 * 1000

// Reserve one owned delivery claim across bounded provider retries.
export const claimOtpCooldown = (
  current: OtpCooldownValue | null,
  claimId: string,
  now: number,
): OtpCooldownValue | null => {
  if (current && current.nextAllowedAt > now) {
    return null
  }
  return {
    claimId,
    nextAllowedAt: now + CLAIM_RESERVATION_MS,
    updatedAt: now,
  }
}

// Start full cooldown at successful delivery time for matching owner only.
export const finalizeOtpCooldown = (
  current: OtpCooldownValue,
  claimId: string,
  now: number,
): OtpCooldownValue | null => {
  if (current.claimId !== claimId) {
    return null
  }
  return {
    claimId,
    nextAllowedAt: now + SUCCESS_COOLDOWN_MS,
    updatedAt: now,
  }
}

// Permit release only to current claim owner.
export const releaseOtpCooldown = (
  current: OtpCooldownValue,
  claimId: string,
): boolean => current.claimId === claimId
