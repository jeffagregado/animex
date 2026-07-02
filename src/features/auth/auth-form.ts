import type { FormEvent } from 'react'
import type { z } from 'zod'

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
