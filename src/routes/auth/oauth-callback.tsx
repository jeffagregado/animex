import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { OAuthCallbackPage } from '../../features/auth/oauth-callback-page'

export const Route = createFileRoute('/auth/oauth-callback')({
  component: OAuthCallbackPage,
  validateSearch: z.object({
    error: z.string().optional(),
    error_description: z.string().optional(),
    returnTo: z.string().optional(),
  }),
})
