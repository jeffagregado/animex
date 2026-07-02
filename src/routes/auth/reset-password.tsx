import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ResetPasswordPage } from '../../features/auth/reset-password-page'

const resetPasswordSearchSchema = z.object({
  error: z.string().optional(),
  token: z.string().optional(),
})

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordRoute,
})

function ResetPasswordRoute() {
  const search = Route.useSearch()
  const token = search.error ? null : search.token ?? null

  return <ResetPasswordPage token={token} />
}
