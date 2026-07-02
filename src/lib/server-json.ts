import type { z } from 'zod'

// Parses app-owned JSON request bodies with a clear route-specific error.
export const parseJsonBody = async <TData,>(
  request: Request,
  schema: z.ZodType<TData>,
  errorMessage: string,
): Promise<TData> => {
  const body: unknown = await request.json()
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new Error(errorMessage)
  }
  return result.data
}
