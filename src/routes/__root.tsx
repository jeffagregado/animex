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
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

/** Renders the root AnimeX missing-route boundary. */
function RootNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold tracking-[0.24em] text-cyan-400 uppercase">AnimeX</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          The page you requested does not exist or may have moved.
        </p>
        <a
          href="/home"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/50"
        >
          Home
        </a>
      </section>
    </main>
  )
}

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
