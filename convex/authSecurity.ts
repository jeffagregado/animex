export type RateLimitRule = {
  max: number
  window: number
}

export type RateLimitValue = {
  count: number
  lastRequest: number
}

export type RateLimitDecision = {
  allowed: boolean
  next: RateLimitValue
  retryAfter: number | null
}

export type ResendError = {
  code?: string | null
  message: string
  statusCode?: number | null
}

export type EmailFailureMetadata = {
  attempt: number
  code: string | null
  retryable: boolean
  statusCode: number | null
}

type ResendResult<TData> = {
  data: TData | null
  error: ResendError | null
}

type RetryInput<TData> = {
  delay: (milliseconds: number) => Promise<void>
  send: () => Promise<ResendResult<TData>>
  warn: (message: string, metadata: EmailFailureMetadata) => void
}

const AUTH_RATE_LIMIT_RULES = {
  '/email-otp/*': { max: 5, window: 60 },
  '/forget-password/email-otp': { max: 5, window: 60 },
  '/request-password-reset': { max: 3, window: 60 },
  '/sign-in/email': { max: 3, window: 10 },
  '/sign-in/social': { max: 3, window: 10 },
  '/sign-up/email': { max: 3, window: 10 },
} satisfies Record<string, RateLimitRule>

const RETRY_DELAYS_MS = [500, 1000] as const

class AuthEmailDeliveryError extends Error {
  readonly attempt: number
  readonly code: string | null
  readonly statusCode: number | null

  constructor(message: string, metadata: Omit<EmailFailureMetadata, 'retryable'>) {
    super(message)
    this.name = 'AuthEmailDeliveryError'
    this.attempt = metadata.attempt
    this.code = metadata.code
    this.statusCode = metadata.statusCode
  }
}

// Return locked endpoint rules without exposing mutable shared state.
export const getAuthRateLimitRules = (): Record<string, RateLimitRule> => ({
  ...AUTH_RATE_LIMIT_RULES,
})

// Decide one atomic fixed-window consumption step.
export const consumeRateLimit = (
  current: RateLimitValue | null,
  rule: RateLimitRule,
  now: number,
): RateLimitDecision => {
  const windowMs = rule.window * 1000
  if (!current || now - current.lastRequest > windowMs) {
    return {
      allowed: true,
      next: { count: 1, lastRequest: now },
      retryAfter: null,
    }
  }

  if (current.count >= rule.max) {
    return {
      allowed: false,
      next: current,
      retryAfter: Math.max(1, Math.ceil((current.lastRequest + windowMs - now) / 1000)),
    }
  }

  return {
    allowed: true,
    next: { count: current.count + 1, lastRequest: now },
    retryAfter: null,
  }
}

// Hash normalized limiter subject so raw account data never becomes a key.
export const hashLimiterSubject = async (
  subject: string,
  purpose: string,
): Promise<string> => {
  const normalized = `${purpose}:${subject.trim().toLowerCase()}`
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// Allow reset only for completed profiles or password-backed identities.
export const isPasswordResetEligible = (
  hasProfile: boolean,
  providerIds: string[],
): boolean => hasProfile || providerIds.includes('credential')

const isRetryable = (error: ResendError): boolean => {
  const statusCode = error.statusCode
  return statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500)
}

const readSafeProviderCode = (code: string | null | undefined): string | null => {
  if (!code || !/^[a-zA-Z0-9_-]{1,64}$/.test(code)) return null
  return code
}

const toEmailFailureMetadata = (
  error: ResendError,
  attempt: number,
): EmailFailureMetadata => ({
  attempt,
  code: readSafeProviderCode(error.code),
  retryable: isRetryable(error),
  statusCode: typeof error.statusCode === 'number' ? error.statusCode : null,
})

const createDeliveryError = (
  message: string,
  metadata: EmailFailureMetadata,
): AuthEmailDeliveryError => new AuthEmailDeliveryError(message, {
  attempt: metadata.attempt,
  code: metadata.code,
  statusCode: metadata.statusCode,
})

// Send through Resend with bounded status-aware retries.
export const sendWithRetry = async <TData>({
  delay,
  send,
  warn,
}: RetryInput<TData>): Promise<TData> => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await send()
    if (!error && data) {
      return data
    }
    if (!error) {
      throw new AuthEmailDeliveryError('Resend email failed.', {
        attempt,
        code: null,
        statusCode: null,
      })
    }

    const metadata = toEmailFailureMetadata(error, attempt)

    if (!metadata.retryable) {
      throw createDeliveryError('Resend email failed.', metadata)
    }
    warn('Resend email attempt failed.', metadata)
    if (attempt === 3) {
      throw createDeliveryError('Resend email failed after 3 attempts.', metadata)
    }
    await delay(RETRY_DELAYS_MS[attempt - 1])
  }

  throw new Error('Resend email failed after 3 attempts.')
}
