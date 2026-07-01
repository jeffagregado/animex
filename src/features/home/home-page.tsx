import { Heart, ImagePlus, MessageCircle, MoreHorizontal, Send } from 'lucide-react'

import { cn } from '#/lib/utils'

import {
  animeListMetrics,
  desktopNavigationItems,
  feedEntries,
  headerActions,
  mobileNavigationItems,
  seasonalAnime,
  utilityPosters,
} from './home-data'

export function HomePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 pb-28 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:pb-8">
        <section className="min-w-0 space-y-6">
          <SeasonalRail />
          <FeedTabs />
          <Composer />
          <FeedList />
        </section>
        <aside className="hidden space-y-4 lg:block">
          <MyAnimePanel />
          <PosterPanel />
        </aside>
      </div>
      <MobileBottomNavigation />
    </main>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-background/86 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-4">
        <a className="flex items-center gap-3 text-foreground no-underline" href="/home">
          <span className="grid size-10 place-items-center rounded-full border border-cyan-300/70 bg-cyan-300/10 text-lg font-black text-cyan-300">
            AX
          </span>
          <span className="text-2xl font-black tracking-normal">
            Anime<span className="text-coral-400">X</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {desktopNavigationItems.map((item) => (
            <a className={cn('nav-link', item.active ? 'is-active' : '')} href="/home" key={item.label}>
              <item.icon aria-hidden="true" className="size-5" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {headerActions.map((item) => (
            <button className="icon-button" type="button" aria-label={item.label} key={item.label}>
              <item.icon aria-hidden="true" className="size-5" />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

function SeasonalRail() {
  return (
    <section aria-labelledby="seasonal-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 id="seasonal-heading" className="text-xl font-extrabold sm:text-2xl">
          Seasonal Anime
        </h1>
        <button className="text-sm font-bold text-cyan-300" type="button">
          See more
        </button>
      </div>
      <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
        {seasonalAnime.map((anime) => (
          <article className="poster-card" key={anime.title}>
            <img className="poster-card__image" src={anime.imageUrl} alt={`${anime.title} cover`} />
            <div className="poster-card__shade" />
            <div className="poster-card__copy">
              <h2>{anime.title}</h2>
              <p>{anime.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function FeedTabs() {
  return (
    <div className="flex gap-8 border-b border-white/8">
      {['Home', 'Following', 'Global'].map((tab) => (
        <button className={cn('feed-tab', tab === 'Home' ? 'is-active' : '')} type="button" key={tab}>
          {tab}
        </button>
      ))}
    </div>
  )
}

function Composer() {
  return (
    <section className="panel flex items-center gap-3 p-3" aria-label="Post composer preview">
      <div className="avatar">AF</div>
      <div className="min-w-0 flex-1 text-base text-muted-foreground">What are you watching?</div>
      <button className="icon-button text-cyan-300" type="button" aria-label="Attach image">
        <ImagePlus aria-hidden="true" className="size-5" />
      </button>
      <button className="icon-button text-cyan-300" type="button" aria-label="Send post">
        <Send aria-hidden="true" className="size-5" />
      </button>
    </section>
  )
}

function FeedList() {
  return (
    <section className="space-y-4" aria-label="Home feed preview">
      {feedEntries.map((entry) => (
        <article className={`feed-card feed-card--${entry.accent}`} key={`${entry.author}-${entry.animeTitle}`}>
          <div className="flex items-start gap-3">
            <div className="avatar">{entry.author.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="font-extrabold">{entry.author}</h2>
                <span className="text-muted-foreground">{entry.action}</span>
                <span className="text-sm text-muted-foreground">{entry.time}</span>
              </div>
              <p className="mt-2 max-w-3xl leading-7 text-slate-200">{entry.body}</p>
              <div className="mt-4 grid gap-4 rounded-md border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-[84px_minmax(0,1fr)_auto]">
                <img className="h-28 w-20 rounded-md object-cover" src={entry.imageUrl} alt={`${entry.animeTitle} cover`} />
                <div className="min-w-0">
                  <h3 className="font-extrabold">{entry.animeTitle}</h3>
                  <p className="text-sm text-muted-foreground">{entry.animeMeta}</p>
                </div>
                {entry.score ? (
                  <div className="self-end text-right">
                    <p className="text-xs uppercase text-muted-foreground">Score</p>
                    <p className="text-3xl font-black text-cyan-300">{entry.score}</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 text-coral-400">
                  <Heart aria-hidden="true" className="size-5 fill-current" />
                  {entry.likes}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MessageCircle aria-hidden="true" className="size-5" />
                  {entry.comments}
                </span>
              </div>
            </div>
            <button className="icon-button" type="button" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" className="size-5" />
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

function MyAnimePanel() {
  return (
    <section className="panel p-5" aria-labelledby="my-anime-heading">
      <h2 id="my-anime-heading" className="text-lg font-extrabold">
        My Anime
      </h2>
      <div className="mt-4 grid gap-3">
        {animeListMetrics.map((metric) => (
          <div className="metric-row" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.count}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function PosterPanel() {
  return (
    <section className="panel p-5" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" className="text-lg font-extrabold">
        Latest Favorites
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {utilityPosters.map((anime) => (
          <img className="aspect-[2/3] rounded-md object-cover" src={anime.imageUrl} alt={`${anime.title} cover`} key={anime.title} />
        ))}
      </div>
    </section>
  )
}

function MobileBottomNavigation() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/8 bg-background/92 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile">
      {mobileNavigationItems.map((item) => (
        <button className={cn('mobile-nav-item', item.active ? 'is-active' : '')} type="button" key={item.label}>
          <item.icon aria-hidden="true" className="size-6" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
