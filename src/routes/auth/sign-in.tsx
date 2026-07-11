import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SignInPage } from '../../features/auth/sign-in-page'

export const Route = createFileRoute('/auth/sign-in')({
  component: SignInPage,
  validateSearch: z.object({ returnTo: z.string().optional() }),
})
