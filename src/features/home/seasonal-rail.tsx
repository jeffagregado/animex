import { seasonalAnime } from './home-data'

export function SeasonalRail() {
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
