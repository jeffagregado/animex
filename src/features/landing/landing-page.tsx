import { Link } from '@tanstack/react-router'

import { QuickSearchHeader } from '../quick-search/ui/quick-search-header'
import { QuickSearchProvider } from '../quick-search/ui/quick-search-provider'
import { mainNavigationItems } from '../shell/navigation'
import { PublicAuthStateProvider } from '../shell/public-auth-context'

export function LandingPage() {
  return (
    <PublicAuthStateProvider>
      <QuickSearchProvider>
        <div className="landing-page min-h-dvh text-foreground">
          <QuickSearchHeader
            navItems={mainNavigationItems}
            showAuthAction={true}
          />
          <main className="landing-hero">
            <div className="landing-signal" aria-hidden="true">
              <span className="landing-signal__ring landing-signal__ring--outer" />
              <span className="landing-signal__ring landing-signal__ring--middle" />
              <span className="landing-signal__ring landing-signal__ring--inner" />
              <span className="landing-signal__ring landing-signal__ring--dotted" />
              <span className="landing-signal__mark">
                <span className="landing-signal__mark-a">A</span>
                <span className="landing-signal__mark-x">X</span>
              </span>
            </div>
            <section className="landing-hero__content" aria-labelledby="landing-heading">
              <h1 id="landing-heading">Find anime worth remembering.</h1>
              <p>Build your list. Share what stays with you.</p>
              <Link className="landing-hero__action" to="/discover">
                Discover anime
              </Link>
            </section>
          </main>
        </div>
      </QuickSearchProvider>
    </PublicAuthStateProvider>
  )
}
