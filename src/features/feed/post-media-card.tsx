import { useState } from 'react'
import { ExternalLinkIcon, ImageOffIcon, PlayIcon } from 'lucide-react'

import { getLinkedVideoLabel, type PostMedia } from '../social/shared/external-media'

interface PostMediaCardProps {
  media: PostMedia
  username: string
}

/** Extracts only validated YouTube IDs suitable for thumbnail URLs. */
const getYouTubeId = (value: string): string | null => {
  const url = new URL(value)
  const candidate = url.hostname === 'youtu.be'
    ? url.pathname.split('/')[1]
    : url.searchParams.get('v') ?? (/^\/(?:embed|shorts)\/([^/]+)/.exec(url.pathname)?.[1] ?? null)
  return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null
}

/** Renders one external image or safe linked-video card. */
export function PostMediaCard({ media, username }: PostMediaCardProps) {
  const [broken, setBroken] = useState(false)
  if (media.type === 'image') {
    const alt = media.description?.trim() || `Image attached to post by ${username}`
    return <div className="mt-3 aspect-video max-h-[32rem] overflow-hidden rounded-lg border border-white/10 bg-black/20">{broken
      ? <div className="grid h-full min-h-40 place-items-center text-muted-foreground"><span className="flex items-center gap-2"><ImageOffIcon className="size-5" />Image unavailable</span></div>
      : <img alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} referrerPolicy="no-referrer" src={media.url} />}</div>
  }

  const title = getLinkedVideoLabel(media.url, media.provider, media.label)
  const youtubeId = media.provider === 'youtube' ? getYouTubeId(media.url) : null
  return <a aria-label={title} className="mt-3 grid min-h-28 grid-cols-[8rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card transition hover:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={media.url} rel="noreferrer noopener" target="_blank">
    {youtubeId ? <span className="relative"><img alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} /><PlayIcon aria-hidden="true" className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white" /></span> : <span className="grid place-items-center bg-cyan-300/5"><PlayIcon aria-hidden="true" className="size-8 text-cyan-300" /></span>}
    <span className="flex min-w-0 items-center gap-3 p-4"><span className="min-w-0 flex-1"><strong className="block break-words">{title}</strong><span className="mt-1 block capitalize text-cyan-300">{media.provider === 'external' ? new URL(media.url).hostname.toLowerCase() : media.provider}</span></span><ExternalLinkIcon aria-hidden="true" className="size-5 shrink-0 text-cyan-300" /></span>
  </a>
}
