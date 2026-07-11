import { z } from 'zod'

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/

const trimString = (value: string): string => value.trim()

export const accountEmailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email({ pattern: z.regexes.html5Email, error: 'Enter a valid email address.' }))

export const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be 8-24 characters.' })
  .max(24, { error: 'Password must be 8-24 characters.' })

export const usernameSchema = z
  .string()
  .transform(trimString)
  .pipe(
    z
      .string()
      .min(3, { error: 'Username must be 3-30 characters.' })
      .max(30, { error: 'Username must be 3-30 characters.' })
      .regex(USERNAME_PATTERN, { error: 'Use letters, numbers, and underscores only.' })
      .refine((value) => !value.startsWith('_') && !value.endsWith('_'), {
        error: 'Username cannot start or end with underscore.',
      }),
  )

export const otpSchema = z
  .string()
  .transform(trimString)
  .pipe(z.string().min(1, { error: 'Verification code is required.' }))

export const resetTokenSchema = z
  .string()
  .transform(trimString)
  .pipe(z.string().min(1, { error: 'Reset token is required.' }))

export const confirmPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords must match.',
  })

export const signInSchema = z.object({
  email: accountEmailSchema,
  password: z.string().min(1, { error: 'Password is required.' }),
})

export const signUpSchema = z.object({
  email: accountEmailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  error: 'Passwords must match.',
})

export const forgotPasswordSchema = z.object({
  email: accountEmailSchema,
})

export const verifyEmailSchema = z.object({
  email: accountEmailSchema,
  otp: otpSchema,
})

export const emailChangeRequestSchema = z.object({
  newEmail: accountEmailSchema,
})

const getEmailChangeOtpSchema = (required: boolean): z.ZodType<string, string> => {
  return required ? otpSchema : z.string()
}

export const emailChangeSendSchema = z.object({
  newEmail: accountEmailSchema,
  otp: getEmailChangeOtpSchema(false),
})

export const emailChangeConfirmSchema = z.object({
  newEmail: accountEmailSchema,
  otp: getEmailChangeOtpSchema(true),
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  error: 'Passwords must match.',
})

export const usernameFormSchema = z.object({
  username: usernameSchema,
})

export const resetTokenBodySchema = z.object({
  token: resetTokenSchema,
})
