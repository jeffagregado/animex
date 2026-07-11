import { api } from '../../../../convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { usernameSchema } from '../../../lib/auth-schemas'
import { getAuthProxy } from '../../../lib/server-auth-proxy'

const PROFILE_COMPLETION_SCOPE = 'AnimeX profile completion'

type CompleteProfileBody = {
  username: string
}

type ClientError = {
  message: string
  status: number
}

type ErrorRule = {
  includes: string
  clientError: ClientError
}

const errorRules: ErrorRule[] = [
  {
    includes: 'EMAIL_NOT_VERIFIED',
    clientError: {
      message: 'Verify your email before completing your profile.',
      status: 401,
    },
  },
  {
    includes: 'USERNAME_TAKEN',
    clientError: {
      message: 'Username is already taken.',
      status: 409,
    },
  },
  {
    includes: 'INVALID_USERNAME',
    clientError: {
      message: 'Username is invalid.',
      status: 400,
    },
  },
  {
    includes: 'Profile completion username',
    clientError: {
      message: 'Username is required.',
      status: 400,
    },
  },
]

const isRecordBody = (body: unknown): body is Record<string, unknown> => {
  return Boolean(body) && typeof body === 'object'
}

const readBodyUsername = (body: Record<string, unknown>): string => {
  const username = body.username
  if (typeof username !== 'string') {
    throw new Error('Profile completion username must be a string.')
  }
  const result = usernameSchema.safeParse(username)
  if (!result.success) {
    throw new Error('INVALID_USERNAME')
  }
  return result.data
}

const parseCompleteProfileBody = async (request: Request): Promise<CompleteProfileBody> => {
  const body: unknown = await request.json()

  if (!isRecordBody(body)) {
    throw new Error('Profile completion requires a username.')
  }

  return { username: readBodyUsername(body) }
}

const getClientError = (error: unknown): { message: string; status: number } => {
  if (error instanceof Error) {
    const rule = errorRules.find((item) => error.message.includes(item.includes))
    if (rule) {
      return rule.clientError
    }
  }
  return { message: 'Profile completion failed.', status: 500 }
}

export const Route = createFileRoute('/api/profile/complete')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await parseCompleteProfileBody(request)
          await getAuthProxy(PROFILE_COMPLETION_SCOPE).fetchAuthAction(api.users.completeProfile, {
            username: body.username,
          })
          return Response.json({ ok: true })
        } catch (error) {
          console.error('Profile completion failed.', error)
          const clientError = getClientError(error)
          return new Response(clientError.message, { status: clientError.status })
        }
      },
    },
  },
})
