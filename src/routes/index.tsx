import { createFileRoute } from '@tanstack/react-router'

import { LandingPage } from '#/features/landing/landing-page'
import { getLandingHead } from './-index-head'

export const Route = createFileRoute('/')({
  head: getLandingHead,
  component: LandingPage,
})
