import type { Metadata } from "next";

import { ChartsView } from "@/components/charts/charts-view";
import { StatTile } from "@/components/stat-tile";
import { formatStreams } from "@/lib/format";
import {
  getArchiveSummary,
  getCountryStats,
  getDecadeStats,
  getGenreStats,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "Streams by genre and country of origin, and debut years by decade, " +
    "across the 500 artists in the dataset.",
};

export const revalidate = 3600;

export default async function ChartsPage() {
  // All three come from SQL views, so Postgres does the grouping and the page
  // never pulls 500 rows over the wire to aggregate them in JavaScript.
  const [genres, countries, decades, summary] = await Promise.all([
    getGenreStats(),
    getCountryStats(),
    getDecadeStats(),
    getArchiveSummary(),
  ]);

  const topGenre = genres[0];
  const topCountry = countries[0];
  const busiestDecade = decades.reduce((a, b) =>
    b.artist_count > a.artist_count ? b : a,
  );

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
          Where the streams concentrate, and when the artists holding them
          arrived. Every figure below comes from the dataset snapshot, not from
          a live API.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          value={formatStreams(summary.totalStreamsM)}
          label="streams in the set"
          accent="pink"
        />
        <StatTile
          value={topGenre?.genre ?? "--"}
          label="biggest genre"
          numeric={false}
          hint={`${formatStreams(topGenre?.total_streams_m)} across ${topGenre?.artist_count} artists`}
          accent="cyan"
        />
        <StatTile
          value={topCountry?.country ?? "--"}
          label="biggest country"
          numeric={false}
          hint={`${formatStreams(topCountry?.total_streams_m)} across ${topCountry?.artist_count} artists`}
          accent="amber"
        />
        <StatTile
          value={`${busiestDecade?.decade}s`}
          label="busiest debut decade"
          hint={`${busiestDecade?.artist_count} artists debuted`}
          accent="mint"
        />
      </div>

      <div className="mt-10">
        <ChartsView
          genres={genres}
          countries={countries}
          decades={decades}
        />
      </div>
    </div>
  );
}
