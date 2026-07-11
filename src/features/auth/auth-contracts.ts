import { z } from 'zod'

export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_EMAIL_OR_PASSWORD',
  invalidOtp: 'INVALID_OTP',
  accountNotLinked: 'account_not_linked',
  emailInUse: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  providerNotFound: 'PROVIDER_NOT_FOUND',
  providerNotConfigured: 'PROVIDER_NOT_CONFIGURED',
  providerNotSupported: 'PROVIDER_NOT_SUPPORTED',
  otpExpired: 'OTP_EXPIRED',
  tooManyOtpAttempts: 'TOO_MANY_ATTEMPTS',
  tooManyRequests: 'TOO_MANY_REQUESTS',
} as const

export type AuthResponseError = {
  code?: string
  message?: string
  status?: number
  statusText?: string
}

export type AuthResponse<TData> = {
  data: TData | null
  error: AuthResponseError | null
}

const authProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  visibility: z.enum(['private', 'followers', 'public']),
}).strict()

export const authStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('signedOut'),
  }).strict(),
  z.object({
    status: z.literal('emailUnverified'),
    email: z.email(),
  }).strict(),
  z.object({
    status: z.literal('needsProfile'),
    email: z.email(),
    signupMethod: z.enum(['password', 'oauth']),
    suggestedUsername: z.string().nullable(),
  }).strict(),
  z.object({
    status: z.literal('complete'),
    email: z.email(),
    profile: authProfileSchema,
  }).strict(),
])

export type AuthState = z.infer<typeof authStateSchema>
