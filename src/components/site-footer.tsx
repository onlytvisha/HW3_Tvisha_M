import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-sw-line/60 relative mt-24 overflow-hidden border-t">
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="font-heading text-sm font-bold tracking-[0.2em] uppercase">
              <span className="text-sw-pink">Neon</span>{" "}
              <span className="text-sw-cyan">Archive</span>
            </p>
            <p className="text-sw-text-dim mt-3 text-sm leading-relaxed">
              500 streaming artists, their lifetime stream splits, and whatever
              they happen to be biggest for right now.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-sw-text mb-3 font-medium">Browse</p>
              <ul className="text-sw-text-dim space-y-2">
                <li>
                  <Link
                    href="/artists"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Full archive
                  </Link>
                </li>
                <li>
                  <Link
                    href="/genres"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Genres
                  </Link>
                </li>
                <li>
                  <Link
                    href="/charts"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Charts
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    About the data
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sw-text mb-3 font-medium">Sources</p>
              <ul className="text-sw-text-dim space-y-2">
                <li>
                  <a
                    href="https://developer.spotify.com/documentation/web-api"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Spotify Web API
                  </a>
                </li>
                <li>
                  <a
                    href="https://performance-partners.apple.com/search-api"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    iTunes Search API
                  </a>
                </li>
                <li>
                  <a
                    href="https://music.youtube.com"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    YouTube Music
                  </a>
                </li>
                <li>
                  <a
                    href="https://musicbrainz.org"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    MusicBrainz
                  </a>
                </li>
                <li>
                  <a
                    href="https://en.wikipedia.org"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Wikipedia
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.kaggle.com/datasets"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-sw-cyan transition-colors"
                  >
                    Kaggle dataset
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-sw-line/50 text-sw-text-dim/80 mt-10 border-t pt-6 text-xs">
          <p>
            Stream totals are a fixed historical snapshot from the source
            dataset, not live 2026 figures.{" "}
            <Link
              href="/about"
              className="text-sw-pink/90 hover:text-sw-pink underline underline-offset-2"
            >
              What that means
            </Link>
            .
          </p>
          <p className="mt-2">
            Built with Next.js, shadcn/ui and Supabase. Not affiliated with
            Apple or Spotify.
          </p>
        </div>
      </div>
    </footer>
  );
}
