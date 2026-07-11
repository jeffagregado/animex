import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { SignUpPage } from '../../features/auth/sign-up-page'

export const Route = createFileRoute('/auth/sign-up')({
  component: SignUpPage,
  validateSearch: z.object({ returnTo: z.string().optional() }),
})
