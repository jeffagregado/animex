import type { FormEvent } from 'react'
import type { z } from 'zod'

export type AuthFieldErrors = Readonly<Record<string, string>>

type ParseResult<TData> =
  | {
      ok: true
      data: TData
    }
  | {
      ok: false
      message: string
    }

export const submitAuthForm = (
  event: FormEvent<HTMLFormElement>,
  handleSubmit: () => void,
): void => {
  event.preventDefault()
  event.stopPropagation()
  void handleSubmit()
}

// Reads first user-facing error from TanStack Form metadata.
export const getAuthFieldError = (errors: unknown[]): string | null => {
  for (const error of errors) {
    if (typeof error === 'string') return error
    if (
      typeof error === 'object'
      && error !== null
      && 'message' in error
      && typeof error.message === 'string'
    ) return error.message
  }
  return null
}

// Collects first Zod issue for each top-level auth field.
export const getAuthSchemaErrors = (
  schema: z.ZodType,
  value: unknown,
): AuthFieldErrors => {
  const result = schema.safeParse(value)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || errors[field]) continue
    errors[field] = issue.message
  }
  return errors
}

// Focuses first editable invalid auth control after submit validation.
export const focusFirstInvalidAuthField = (
  form: HTMLFormElement | null,
  fieldNames: readonly string[],
): void => {
  if (!form) return
  for (const name of fieldNames) {
    const control = form.elements.namedItem(name)
    if (!(control instanceof HTMLInputElement) || control.readOnly || control.disabled) continue
    if (control.getAttribute('aria-invalid') !== 'true') continue
    control.focus()
    return
  }
}

// Keeps Zod errors aligned with the existing single auth message UI.
export const parseAuthInput = <TData,>(
  schema: z.ZodType<TData>,
  value: unknown,
  fallback: string,
): ParseResult<TData> => {
  const result = schema.safeParse(value)
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? fallback,
    }
  }
  return {
    ok: true,
    data: result.data,
  }
}
