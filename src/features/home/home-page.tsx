import { FeedPage, type HomeFeedSearch } from '../feed/feed-page'

/** Keeps route concerns outside feed UI. */
export function HomePage({ search = { feed: 'home', compose: false }, onSearchChange = () => undefined }: { search?: HomeFeedSearch; onSearchChange?: (next: HomeFeedSearch) => void }) { return <FeedPage onSearchChange={onSearchChange} search={search} /> }
