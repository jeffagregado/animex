// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './home-page'

describe('HomePage', () => {
  it('renders the AnimeX shell navigation and feed preview', () => {
    render(<HomePage />)

    expect(screen.getByRole('link', { name: /AnimeX/i })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'My Anime' })).toBeTruthy()
    expect(screen.getByText('What are you watching?')).toBeTruthy()
  })
})
