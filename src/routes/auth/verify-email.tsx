import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { VerifyEmailPage } from '../../features/auth/verify-email-page'

export const Route = createFileRoute('/auth/verify-email')({
  component: VerifyEmailPage,
  validateSearch: z.object({ email: z.string().optional() }),
})
