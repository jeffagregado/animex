import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import ConvexProvider from '../integrations/convex/provider'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Toaster } from '../components/ui/sonner'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const SHOW_TANSTACK_DEVTOOLS = false

/** Returns shared document metadata and global assets. */
export const getRootHead = () => ({
  meta: [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { title: 'AnimeX' },
    { name: 'theme-color', content: '#071522' },
  ],
  links: [
    { rel: 'stylesheet', href: appCss },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    {
      rel: 'icon',
      href: '/favicon.ico',
      sizes: '16x16 32x32 48x48 64x64',
      type: 'image/x-icon',
    },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
    { rel: 'manifest', href: '/manifest.json' },
  ],
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: getRootHead,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexProvider>
          {children}
          <Toaster />
          {SHOW_TANSTACK_DEVTOOLS ? (
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
                TanStackQueryDevtools,
              ]}
            />
          ) : null}
        </ConvexProvider>
        <Scripts />
      </body>
    </html>
  )
}
