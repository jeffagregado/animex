import { createFileRoute } from '@tanstack/react-router'

import type { FileRoutesByPath } from '@tanstack/react-router'

type ServerRouteContext = {
  request: Request
}

type ServerRouteHandler = (ctx: ServerRouteContext) => Response | Promise<Response>

export type ServerRouteConfig = {
  server: {
    handlers: Partial<
      Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD', ServerRouteHandler>
    >
  }
}

export const createStartServerRoute = <TPath extends keyof FileRoutesByPath>(
  path: TPath,
  config: ServerRouteConfig,
) => {
  const createRoute = createFileRoute(path)
  type RouteOptions = Parameters<typeof createRoute>[0]

  return createRoute(config as unknown as RouteOptions)
}
