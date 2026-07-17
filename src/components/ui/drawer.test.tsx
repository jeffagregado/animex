// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentProps } from 'react'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'

import * as drawer from './drawer'

const {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} = drawer

afterEach(cleanup)

describe('Drawer', () => {
  it('requires callers to choose swipe handle visibility', () => {
    type DrawerProps = ComponentProps<typeof Drawer>
    type ShowSwipeHandleIsRequired = DrawerProps extends {
      showSwipeHandle: boolean
    }
      ? true
      : false

    expectTypeOf<ShowSwipeHandleIsRequired>().toEqualTypeOf<true>()
  })

  it('exports the complete shared primitive surface', () => {
    expect(Object.keys(drawer).sort()).toEqual(
      [
        'Drawer',
        'DrawerClose',
        'DrawerContent',
        'DrawerDescription',
        'DrawerFooter',
        'DrawerHeader',
        'DrawerOverlay',
        'DrawerPortal',
        'DrawerSwipeHandle',
        'DrawerTitle',
        'DrawerTrigger',
      ].sort(),
    )
  })

  it('defaults to downward swipe dismissal', () => {
    render(
      <Drawer open showSwipeHandle={false}>
        <DrawerContent>
          <DrawerTitle>Profile</DrawerTitle>
          <DrawerDescription>Edit your profile.</DrawerDescription>
        </DrawerContent>
      </Drawer>,
    )

    expect(
      screen.getByRole('dialog').getAttribute('data-swipe-direction'),
    ).toBe('down')
  })

  it.each([
    [true, true],
    [false, false],
  ])('shows the swipe handle only when enabled', (showSwipeHandle, shown) => {
    const { container } = render(
      <Drawer open showSwipeHandle={showSwipeHandle}>
        <DrawerContent>
          <DrawerTitle>Profile</DrawerTitle>
          <DrawerDescription>Edit your profile.</DrawerDescription>
        </DrawerContent>
      </Drawer>,
    )

    expect(
      container.ownerDocument.querySelector(
        '[data-slot="drawer-swipe-handle"]',
      ) !== null,
    ).toBe(shown)
  })

  it('composes portal, overlay, viewport, popup, and scrollable content', () => {
    const { container } = render(
      <Drawer open showSwipeHandle={false}>
        <DrawerContent>
          <DrawerTitle>Profile</DrawerTitle>
          <DrawerDescription>Edit your profile.</DrawerDescription>
          <p>Drawer body</p>
        </DrawerContent>
      </Drawer>,
    )
    const document = container.ownerDocument
    const content = document.querySelector('[data-slot="drawer-content"]')

    expect(document.querySelector('[data-slot="drawer-portal"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="drawer-overlay"]')).not.toBeNull()
    expect(
      document.querySelector('[data-slot="drawer-viewport"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-slot="drawer-popup"]')).not.toBeNull()
    expect(content?.classList.contains('flex-1')).toBe(true)
    expect(content?.classList.contains('overflow-y-auto')).toBe(true)
    expect(content?.classList.contains('h-full')).toBe(false)
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy()
    expect(screen.getByText('Edit your profile.')).toBeTruthy()
  })

  it('supports Base UI render props for trigger and close', () => {
    render(
      <Drawer showSwipeHandle={false}>
        <DrawerTrigger render={<button type="button" />}>
          Open profile
        </DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Profile</DrawerTitle>
          <DrawerDescription>Edit your profile.</DrawerDescription>
          <DrawerClose render={<button type="button" />}>
            Close profile
          </DrawerClose>
        </DrawerContent>
      </Drawer>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close profile' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('uses Base UI without Vaul or Radix drawer primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/ui/drawer.tsx'),
      'utf8',
    )

    expect(source).toContain('@base-ui/react/drawer')
    expect(source).not.toMatch(/\bvaul\b/i)
    expect(source).not.toMatch(/@radix-ui/i)
  })

  it('suppresses transition durations for reduced motion', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/ui/drawer.tsx'),
      'utf8',
    )

    expect(source.match(/motion-reduce:duration-0/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
