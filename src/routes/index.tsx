import { createFileRoute } from '@tanstack/react-router'

import { LandingPage } from '#/features/landing/landing-page'

/** Returns indexable metadata for the public landing page. */
export const getLandingHead = () => ({
  meta: [
    { title: 'AnimeX - Find anime worth remembering' },
    {
      name: 'description',
      content: 'Build your list. Share what stays with you.',
    },
  ],
})

export const Route = createFileRoute('/')({
  head: getLandingHead,
  component: LandingPage,
})
