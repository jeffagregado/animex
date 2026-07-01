import { createFileRoute } from '@tanstack/react-router'

import { UsernamePage } from '../../features/auth/username-page'

export const Route = createFileRoute('/auth/oauth-username')({
  component: UsernamePage,
})
