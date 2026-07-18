import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  LoaderCircle,
  LogInIcon,
  LogOutIcon,
  UserRoundIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AsyncButton } from '../../components/async-button'
import { UserAvatar } from '../../components/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { authClient } from '../../lib/auth-client'
import { assertAuthResponse } from '../auth/auth-actions'
import { isCompleteAuthState } from '../auth/use-auth-state'
import { usePublicAuthState } from './public-auth-context'

type HeaderAuthView = 'loading' | 'signedOut' | 'pending' | 'complete' | 'error'
type SignOutRequest = () => Promise<void>
type NavigateAfterSignOut = (path: string) => void

/** Completes one sign-out request before full-document Home navigation. */
export const runHeaderSignOut = async (
  request: SignOutRequest,
  navigate: NavigateAfterSignOut,
): Promise<void> => {
  await request()
  navigate('/home')
}

const getHeaderAuthView = (
  state: ReturnType<typeof usePublicAuthState>,
): HeaderAuthView => {
  if (state.status === 'loading') return 'loading'
  if (state.status === 'error') return 'error'
  if (state.authState.status === 'signedOut') return 'signedOut'
  return isCompleteAuthState(state.authState) ? 'complete' : 'pending'
}

export function HeaderAuthControls() {
  const authState = usePublicAuthState()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const signingOutRef = useRef(false)
  const view = getHeaderAuthView(authState)

  const handleSignOut = async (): Promise<void> => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    setIsSigningOut(true)
    try {
      await runHeaderSignOut(
        async () => {
          await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
        },
        (path) => window.location.assign(path),
      )
    } catch (error: unknown) {
      signingOutRef.current = false
      setIsSigningOut(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Sign out failed. Retry from the account menu.',
      )
    }
  }

  if (view === 'loading') {
    return (
      <span
        aria-hidden="true"
        className="header-auth-skeleton"
        data-testid="header-auth-skeleton"
      />
    )
  }
  if (view === 'error') {
    return (
      <button
        className="header-auth-button"
        disabled
        title={authState.status === 'error' ? authState.message : 'Auth error'}
        type="button"
      >
        Auth error
      </button>
    )
  }
  if (view === 'signedOut') {
    return (
      <a className="header-auth-button" href="/auth/sign-in">
        <LogInIcon aria-hidden="true" className="size-4" />
        <span>Sign in</span>
      </a>
    )
  }
  if (
    view === 'pending'
    || authState.status !== 'ready'
    || authState.authState.status !== 'complete'
  ) {
    return (
      <AsyncButton
        className="header-auth-button"
        isLoading={isSigningOut}
        onClick={() => void handleSignOut()}
        type="button"
      >
        <LogOutIcon aria-hidden="true" className="size-4" />
        <span>Sign out</span>
      </AsyncButton>
    )
  }

  const profile = authState.authState.profile
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${profile.name} account menu`}
        className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <UserAvatar
          avatarUrl={profile.avatarUrl}
          displayName={profile.name}
          label={`${profile.name} avatar`}
          size="md"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="min-h-11"
            render={(
              <Link
                params={{ username: profile.username }}
                search={{ tab: undefined }}
                to="/users/$username"
              />
            )}
          >
            <UserRoundIcon aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
          >
            {isSigningOut ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <LogOutIcon aria-hidden="true" />
            )}
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
