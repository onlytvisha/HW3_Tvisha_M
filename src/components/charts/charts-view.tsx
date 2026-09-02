"use client";

import Link from "next/link";

import { ChartCard } from "@/components/charts/chart-card";
import { DecadeChart } from "@/components/charts/decade-chart";
import { RankedBars } from "@/components/charts/ranked-bars";
import { formatPct, formatStreams } from "@/lib/format";
import type { CountryStat, DecadeStat, GenreStat } from "@/lib/types";

/**
 * The charts page body.
 *
 * A Client Component because Recharts needs the DOM and because ChartCard
 * passes cell-render functions, which cannot cross the server boundary. The
 * page above it stays a Server Component and hands down plain rows.
 */
export function ChartsView({
  genres,
  countries,
  decades,
}: {
  genres: GenreStat[];
  countries: CountryStat[];
  decades: DecadeStat[];
}) {
  const genreRows = genres.map((g) => ({
    label: g.genre,
    value: Number(g.total_streams_m),
    artists: g.artist_count,
    avg: Number(g.avg_streams_m),
    collab: Number(g.avg_collab_pct),
  }));

  // 43 countries is too many bars to read; the tail is long and each entry is
  // a single artist. The table view still carries all of them.
  const countryRows = countries.slice(0, 12).map((c) => ({
    label: c.country,
    value: Number(c.total_streams_m),
    artists: c.artist_count,
    avg: Number(c.avg_streams_m),
  }));

  const allCountryRows = countries.map((c) => ({
    label: c.country,
    value: Number(c.total_streams_m),
    artists: c.artist_count,
    avg: Number(c.avg_streams_m),
  }));

  const decadeRows = decades
    .slice()
    .sort((a, b) => a.decade - b.decade)
    .map((d) => ({
      label: `${d.decade}s`,
      artists: d.artist_count,
      value: Number(d.total_streams_m),
    }));

  return (
    <div className="space-y-8">
      <ChartCard
        title="Streams by genre"
        caption="Lifetime streams summed across every artist filed under each primary genre. Genre here is the dataset's single-label classification, not the finer-grained tags Apple files each artist under."
        rows={genreRows}
        columns={[
          {
            header: "Genre",
            cell: (r) => (
              <Link
                href={`/artists?genre=${encodeURIComponent(String(r.label))}`}
                className="hover:text-sw-cyan transition-colors"
              >
                {String(r.label)}
              </Link>
            ),
          },
          {
            header: "Artists",
            numeric: true,
            cell: (r) => String(r.artists),
          },
          {
            header: "Total streams",
            numeric: true,
            cell: (r) => formatStreams(Number(r.value)),
          },
          {
            header: "Average per artist",
            numeric: true,
            cell: (r) => formatStreams(Number(r.avg)),
          },
          {
            header: "Avg. collaborative",
            numeric: true,
            cell: (r) => formatPct(Number(r.collab)),
          },
        ]}
      >
        <RankedBars data={genreRows} color="var(--chart-1)" />
      </ChartCard>

      <ChartCard
        title="Where the streams come from"
        caption="The twelve highest-streaming countries of origin. The table lists all of them, including the long tail of countries represented by a single artist."
        rows={allCountryRows}
        columns={[
          {
            header: "Country",
            cell: (r) => (
              <Link
                href={`/artists?country=${encodeURIComponent(String(r.label))}`}
                className="hover:text-sw-cyan transition-colors"
              >
                {String(r.label)}
              </Link>
            ),
          },
          {
            header: "Artists",
            numeric: true,
            cell: (r) => String(r.artists),
          },
          {
            header: "Total streams",
            numeric: true,
            cell: (r) => formatStreams(Number(r.value)),
          },
          {
            header: "Average per artist",
            numeric: true,
            cell: (r) => formatStreams(Number(r.avg)),
          },
        ]}
      >
        <RankedBars data={countryRows} color="var(--chart-2)" />
      </ChartCard>

      <ChartCard
        title="When they arrived"
        caption="Debut year by decade. The shape says as much about how the dataset was assembled as about music: acts who debuted recently have had less time to accumulate streams, and acts from before streaming existed are only here if their catalogue survived onto it."
        rows={decadeRows}
        columns={[
          { header: "Decade", cell: (r) => String(r.label) },
          {
            header: "Artists who debuted",
            numeric: true,
            cell: (r) => String(r.artists),
          },
          {
            header: "Total streams",
            numeric: true,
            cell: (r) => formatStreams(Number(r.value)),
          },
        ]}
      >
        <DecadeChart data={decades} />
      </ChartCard>
    </div>
  );
}
