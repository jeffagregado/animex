export type ValidationResult =
  | {
      valid: true
    }
  | {
      valid: false
      message: string
    }

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/

export const validateUsername = (username: string): ValidationResult => {
  if (username.length < 3 || username.length > 30) {
    return {
      valid: false,
      message: 'Username must be 3-30 characters.',
    }
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      message: 'Use letters, numbers, and underscores only.',
    }
  }
  if (username.startsWith('_') || username.endsWith('_')) {
    return {
      valid: false,
      message: 'Username cannot start or end with underscore.',
    }
  }
  return { valid: true }
}

export const validatePassword = (password: string): ValidationResult => {
  if (password.length < 8 || password.length > 24) {
    return {
      valid: false,
      message: 'Password must be 8-24 characters.',
    }
  }
  return { valid: true }
}

export const normalizeAccountEmail = (email: string): string => {
  return email.trim().toLowerCase()
}
