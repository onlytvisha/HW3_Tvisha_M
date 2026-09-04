import type { Metadata } from "next";

import { ChartsView } from "@/components/charts/charts-view";
import { StatTile } from "@/components/stat-tile";
import { formatCount } from "@/lib/format";
import {
  getArchiveSummary,
  getCountryStats,
  getDecadeStats,
  getListenerBands,
  getGenreStats,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "YouTube Music listeners by genre and country of origin, how listener " +
    "counts are distributed, and debut years by decade, across the whole " +
    "archive.",
};

export const revalidate = 3600;

export default async function ChartsPage() {
  // All of these come from SQL views, so Postgres does the grouping and the
  // page never pulls thousands of rows over the wire to aggregate them in
  // JavaScript - which matters more now the archive is not 500 rows.
  const [genres, countries, decades, listenerBands, summary] =
    await Promise.all([
      getGenreStats(),
      getCountryStats(),
      getDecadeStats(),
      getListenerBands(),
      getArchiveSummary(),
    ]);

  const topGenre = genres[0];
  const topCountry = countries[0];
  // reduce with no seed throws on an empty array, and decade_stats is empty
  // until an artist with a known debut year exists.
  const busiestDecade =
    decades.length > 0
      ? decades.reduce((a, b) => (b.artist_count > a.artist_count ? b : a))
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-sw-cyan text-xs font-medium tracking-[0.3em] uppercase">
          Charts
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          The shape of the set
        </h1>
        <p className="text-sw-text-dim mt-3 max-w-2xl leading-relaxed">
          Where the listeners concentrate, how unevenly they are spread, and
          when the artists holding them arrived. Listener counts are live from
          YouTube Music; the stream columns in the tables are the frozen Kaggle
          figures, and exist for only {summary.archiveCount} of these artists.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          value={formatCount(summary.totalListeners)}
          label="YouTube Music listeners in the archive"
          accent="pink"
        />
        <StatTile
          value={topGenre?.genre ?? "--"}
          label="biggest genre"
          numeric={false}
          hint={`${formatCount(Number(topGenre?.total_listeners))} listeners across ${topGenre?.artist_count} artists`}
          accent="cyan"
        />
        <StatTile
          value={topCountry?.country ?? "--"}
          label="biggest country"
          numeric={false}
          hint={`${formatCount(Number(topCountry?.total_listeners))} listeners across ${topCountry?.artist_count} artists`}
          accent="amber"
        />
        <StatTile
          value={busiestDecade ? `${busiestDecade.decade}s` : "--"}
          label="busiest debut decade"
          hint={
            busiestDecade
              ? `${busiestDecade.artist_count} artists debuted`
              : undefined
          }
          accent="mint"
        />
      </div>

      <div className="mt-10">
        <ChartsView
          genres={genres}
          countries={countries}
          decades={decades}
          listenerBands={listenerBands}
        />
      </div>
    </div>
  );
}
