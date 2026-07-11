type PasswordResetInput = {
  authId: string
  checkEligible: (authId: string) => Promise<boolean>
  clearShadow: (tokenKey: string) => Promise<void>
  deleteVerification: (token: string) => Promise<void>
  logError: (message: string, error: unknown) => void
  markShadow: () => Promise<void>
  schedule: () => Promise<unknown>
  token: string
  tokenKey: string
}

type OtpSendInput = {
  claim: () => Promise<string | null>
  finalize: (claimId: string) => Promise<boolean>
  release: (claimId: string) => Promise<boolean>
  send: () => Promise<void>
}

type NonBlockingScheduleInput = {
  logError: (message: string, error: unknown) => void
  schedule: () => Promise<unknown>
}

const cleanResetArtifacts = async (
  input: Pick<
    PasswordResetInput,
    'clearShadow' | 'deleteVerification' | 'logError' | 'token' | 'tokenKey'
  >,
): Promise<void> => {
  const results = await Promise.allSettled([
    input.deleteVerification(input.token),
    input.clearShadow(input.tokenKey),
  ])
  results.forEach((result) => {
    if (result.status === 'rejected') {
      input.logError('Password reset cleanup failed.', result.reason)
    }
  })
}

// Keep public reset response generic while scheduling provider delivery.
export const orchestratePasswordReset = async (
  input: PasswordResetInput,
): Promise<void> => {
  try {
    if (!await input.checkEligible(input.authId)) {
      await cleanResetArtifacts(input)
      return
    }
    await input.markShadow()
    await input.schedule()
  } catch (error) {
    input.logError('Password reset delivery scheduling failed.', error)
    await cleanResetArtifacts(input)
  }
}

// Own OTP cooldown claim across provider delivery.
export const orchestrateOtpSend = async (input: OtpSendInput): Promise<void> => {
  const claimId = await input.claim()
  if (!claimId) {
    throw new Error('Wait 60 seconds before requesting another verification code.')
  }
  try {
    await input.send()
    if (!await input.finalize(claimId)) {
      throw new Error('OTP send cooldown claim expired before finalization.')
    }
  } catch (error) {
    await input.release(claimId)
    throw error
  }
}

// Isolate scheduler failure from password-reset session lifecycle.
export const scheduleNonBlocking = async (
  input: NonBlockingScheduleInput,
): Promise<void> => {
  try {
    await input.schedule()
  } catch (error) {
    input.logError('Password reset security notice scheduling failed.', error)
  }
}
