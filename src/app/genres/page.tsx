import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StaggerReveal } from "@/components/motion/stagger-reveal";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCount, formatStreams } from "@/lib/format";
import { genreHref } from "@/lib/genres";
import { getArchiveSummary, getGenreStats } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Genres",
  description:
    "Every genre in the archive, ranked by combined YouTube Music monthly " +
    "listeners, with the artists filed under each.",
};

export const revalidate = 3600;

export default async function GenresPage() {
  const [genres, summary] = await Promise.all([
    getGenreStats(),
    getArchiveSummary(),
  ]);

  // The view already orders by listeners, so the first row is the yardstick
  // every bar below is drawn against.
  const biggest = Number(genres[0]?.total_listeners ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-sw-cyan text-xs font-medium tracking-[0.3em] uppercase">
          Genres
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          What the archive is made of
        </h1>
        <p className="text-sw-text-dim mt-3 max-w-2xl leading-relaxed">
          Every artist carries one canonical genre label. Open any of them for
          the artists filed under it, ranked by how big they are right now.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={String(genres.length)} label="genres" accent="pink" />
        <StatTile
          value={summary.artistCount.toLocaleString("en-US")}
          label="artists filed"
          accent="cyan"
        />
        <StatTile
          value={genres[0]?.genre ?? "--"}
          label="biggest genre"
          numeric={false}
          hint={`${formatCount(Number(genres[0]?.total_listeners))} listeners across ${genres[0]?.artist_count} artists`}
          accent="amber"
        />
        <StatTile
          value={formatCount(summary.totalListeners)}
          label="YouTube Music listeners, combined"
          accent="mint"
        />
      </div>

      <StaggerReveal className="mt-10 grid gap-3 sm:grid-cols-2" as="ul">
        {genres.map((genre) => {
          const listeners = Number(genre.total_listeners);
          const share = biggest > 0 ? (listeners / biggest) * 100 : 0;

          return (
            <Card key={genre.genre} className="sw-card group p-0">
              <Link
                href={genreHref(genre.genre)}
                className="focus-visible:ring-ring/60 block rounded-xl p-5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="group-hover:text-sw-pink text-lg font-semibold transition-colors">
                    {genre.genre}
                  </h2>
                  <ArrowUpRight
                    className="text-sw-text-dim group-hover:text-sw-pink mt-1 size-4 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>

                <div className="text-sw-text-dim mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="tnum">
                    {genre.artist_count}{" "}
                    {genre.artist_count === 1 ? "artist" : "artists"}
                  </span>
                  {genre.avg_popularity != null && (
                    <Badge
                      variant="outline"
                      className="border-sw-line text-sw-text-dim px-2 py-0 font-normal"
                    >
                      <span className="tnum">
                        {Number(genre.avg_popularity).toFixed(0)}
                      </span>
                      &nbsp;avg score
                    </Badge>
                  )}
                  {genre.archive_count > 0 && genre.total_streams_m != null && (
                    <span
                      className="tnum"
                      title={`Lifetime streams, summed over the ${genre.archive_count} artists in this genre that have dataset figures`}
                    >
                      {formatStreams(Number(genre.total_streams_m))} streams
                    </span>
                  )}
                </div>

                <p className="tnum text-sw-text mt-4 text-xl font-semibold">
                  {formatCount(listeners)}
                  <span className="text-sw-text-dim/80 ml-1.5 text-[0.6875rem] font-normal tracking-wide uppercase">
                    YouTube Music listeners
                  </span>
                </p>

                {/* One series, so a single hue carries it and no legend is
                      needed - the genre name above is the label. */}
                <div
                  className="bg-sw-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${share.toFixed(0)}% of the listeners held by the largest genre`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${Math.max(share, 1)}%` }}
                  />
                </div>
              </Link>
            </Card>
          );
        })}
      </StaggerReveal>
    </div>
  );
}
