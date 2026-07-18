// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Route } from './__root'

afterEach(cleanup)

describe('root not-found contract', () => {
  it('owns an AnimeX not-found component with a Home destination', () => {
    const NotFound = Route.options.notFoundComponent
    expect(NotFound).toBeTypeOf('function')
    render(<NotFound />)
    expect(screen.getByRole('heading', { name: /not found/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /home/i }).getAttribute('href')).toBe('/home')
  })
})
