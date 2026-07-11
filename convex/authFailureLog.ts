export type SafeFailureMetadata = {
  attempt: number | null
  code: string | null
  statusCode: number | null
}

type FailureRecord = Record<string, unknown>

type SafeLog = (message: string, metadata: SafeFailureMetadata) => void

const isFailureRecord = (error: unknown): error is FailureRecord => {
  return typeof error === 'object' && error !== null
}

const readSafeCode = (value: unknown): string | null => {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value)
    ? value
    : null
}

const readSafeNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

// Keep only stable non-sensitive failure metadata.
export const toSafeFailureMetadata = (error: unknown): SafeFailureMetadata => {
  if (!isFailureRecord(error)) {
    return { attempt: null, code: null, statusCode: null }
  }
  return {
    attempt: readSafeNumber(error.attempt),
    code: readSafeCode(error.code),
    statusCode: readSafeNumber(error.statusCode),
  }
}

// Log failure metadata without forwarding the original error.
export const logSafeFailure = (
  message: string,
  error: unknown,
  log: SafeLog,
): void => {
  log(message, toSafeFailureMetadata(error))
}
