import { animeListMetrics, utilityPosters } from './home-data'

export function HomeSidebar() {
  return (
    <aside className="hidden space-y-4 lg:block">
      <MyAnimePanel />
      <PosterPanel />
    </aside>
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
