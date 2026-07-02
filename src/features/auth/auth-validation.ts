import {
  accountEmailSchema,
  confirmPasswordSchema,
  otpSchema,
  passwordSchema,
  resetTokenSchema,
  usernameSchema,
} from '../../lib/auth-schemas'

export {
  confirmPasswordSchema,
  otpSchema,
  resetTokenSchema,
}

export type ValidationResult =
  | {
      valid: true
    }
  | {
      valid: false
      message: string
    }

export const validateUsername = (username: string): ValidationResult => {
  const result = usernameSchema.safeParse(username)
  if (!result.success) {
    return {
      valid: false,
      message: result.error.issues[0]?.message ?? 'Username is invalid.',
    }
  }
  return { valid: true }
}

export const validatePassword = (password: string): ValidationResult => {
  const result = passwordSchema.safeParse(password)
  if (!result.success) {
    return {
      valid: false,
      message: result.error.issues[0]?.message ?? 'Password is invalid.',
    }
  }
  return { valid: true }
}

export const normalizeAccountEmail = (email: string): string => {
  const result = accountEmailSchema.safeParse(email)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Enter a valid email address.')
  }
  return result.data
}
