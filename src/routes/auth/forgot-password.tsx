import { createFileRoute } from '@tanstack/react-router'

import { ForgotPasswordPage } from '../../features/auth/forgot-password-page'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
})
