import { useEffect, useState } from 'react'

type UserAvatarSize = 'sm' | 'md' | 'lg'
type UserAvatarProps = {
  avatarUrl: string | null
  displayName: string
  label: string
  size: UserAvatarSize
}

const sizeClasses: Record<UserAvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-12 text-base',
}

/** Renders a stable user image or explicit initial fallback. */
export function UserAvatar({ avatarUrl, displayName, label, size }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  useEffect(() => { setFailedUrl(null) }, [avatarUrl])
  const className = `${sizeClasses[size]} shrink-0 rounded-full border border-border`
  if (avatarUrl !== null && avatarUrl !== failedUrl) {
    return <img alt={label} className={`${className} object-cover`} onError={() => setFailedUrl(avatarUrl)} src={avatarUrl} />
  }
  const initial = displayName.trim().slice(0, 1).toUpperCase() || '?'
  return <span aria-label={label} className={`${className} grid place-items-center bg-cyan-300/10 font-black text-cyan-300`} role="img">{initial}</span>
}
