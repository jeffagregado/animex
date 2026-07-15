// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HorizontalRail } from './horizontal-rail'

type RailMetrics = {
  clientWidth: number
  scrollCalls: ScrollToOptions[]
  scrollLeft: number
  scrollWidth: number
}

/** Provides deterministic browser rail metrics while preserving real DOM events. */
function setRailMetrics(viewport: HTMLElement, metrics: RailMetrics): void {
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, get: () => metrics.clientWidth },
    scrollLeft: {
      configurable: true,
      get: () => metrics.scrollLeft,
      set: (value: number) => {
        metrics.scrollLeft = value
      },
    },
    scrollWidth: { configurable: true, get: () => metrics.scrollWidth },
  })
  Object.assign(viewport, {
    scrollBy: (options: ScrollToOptions): void => {
      metrics.scrollCalls.push(options)
      metrics.scrollLeft += options.left ?? 0
      fireEvent.scroll(viewport)
    },
  })
}

afterEach(() => {
  cleanup()
})

describe('HorizontalRail', () => {
  it('stretches direct children only within its own row', () => {
    const view = render(<HorizontalRail label="Trending Anime"><article>Short poster</article><article>Tall poster title</article></HorizontalRail>)
    const viewport = view.getByRole('region', { name: 'Trending Anime' })
    const row = viewport.firstElementChild

    expect(row?.className).toContain('items-stretch')
    expect(row?.className).toContain('[&>*]:h-auto')
  })

  it('scrolls one viewport smoothly and updates boundary controls from scroll events', () => {
    const view = render(<HorizontalRail label="Trending Anime"><article>First poster</article><article>Second poster</article></HorizontalRail>)
    const viewport = view.getByRole('region', { name: 'Trending Anime' })
    const metrics = { clientWidth: 240, scrollCalls: [], scrollLeft: 0, scrollWidth: 720 }
    setRailMetrics(viewport, metrics)
    fireEvent.resize(window)

    const previous = screen.getByRole('button', { name: 'Previous Trending Anime' })
    const next = screen.getByRole('button', { name: 'Next Trending Anime' })
    expect(previous).toHaveProperty('disabled', true)
    expect(next).toHaveProperty('disabled', false)

    fireEvent.click(next)
    expect(metrics.scrollLeft).toBe(240)
    expect(metrics.scrollCalls).toContainEqual({ left: 240, behavior: 'smooth' })
    expect(previous).toHaveProperty('disabled', false)

    metrics.scrollLeft = 480
    fireEvent.scroll(viewport)
    expect(next).toHaveProperty('disabled', true)
  })

  it('recalculates both controls when the viewport resizes', () => {
    const view = render(<HorizontalRail label="Seasonal Anime"><article>Poster</article></HorizontalRail>)
    const viewport = view.getByRole('region', { name: 'Seasonal Anime' })
    const metrics = { clientWidth: 240, scrollCalls: [], scrollLeft: 240, scrollWidth: 720 }
    setRailMetrics(viewport, metrics)
    fireEvent.resize(window)

    expect(screen.getByRole('button', { name: 'Previous Seasonal Anime' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Next Seasonal Anime' })).toHaveProperty('disabled', false)

    metrics.clientWidth = 720
    metrics.scrollLeft = 0
    fireEvent.resize(window)
    expect(screen.getByRole('button', { name: 'Previous Seasonal Anime' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Next Seasonal Anime' })).toHaveProperty('disabled', true)
  })

  it('scrolls backward one viewport and disables previous at the start', () => {
    const view = render(<HorizontalRail label="Popular Recommendations"><article>First poster</article><article>Second poster</article></HorizontalRail>)
    const viewport = view.getByRole('region', { name: 'Popular Recommendations' })
    const metrics = { clientWidth: 240, scrollCalls: [], scrollLeft: 240, scrollWidth: 720 }
    setRailMetrics(viewport, metrics)
    fireEvent.resize(window)

    const previous = screen.getByRole('button', { name: 'Previous Popular Recommendations' })
    expect(previous).toHaveProperty('disabled', false)

    fireEvent.click(previous)
    expect(metrics.scrollCalls).toContainEqual({ left: -240, behavior: 'smooth' })
    expect(metrics.scrollLeft).toBe(0)
    expect(previous).toHaveProperty('disabled', true)
  })

  it('remeasures when children expand the rail without a scroll or window resize event', () => {
    const view = render(<HorizontalRail label="Trending Anime"><article>First poster</article></HorizontalRail>)
    const viewport = view.getByRole('region', { name: 'Trending Anime' })
    const metrics = { clientWidth: 240, scrollCalls: [], scrollLeft: 0, scrollWidth: 240 }
    setRailMetrics(viewport, metrics)
    fireEvent.resize(window)
    expect(screen.getByRole('button', { name: 'Next Trending Anime' })).toHaveProperty('disabled', true)

    metrics.scrollWidth = 720
    view.rerender(<HorizontalRail label="Trending Anime"><article>First poster</article><article>Second poster</article></HorizontalRail>)

    expect(screen.getByRole('button', { name: 'Next Trending Anime' })).toHaveProperty('disabled', false)
  })
})
