"use client";

import Link from "next/link";

import { ChartCard } from "@/components/charts/chart-card";
import { DecadeChart } from "@/components/charts/decade-chart";
import { ListenerDistribution } from "@/components/charts/listener-distribution";
import { RankedBars } from "@/components/charts/ranked-bars";
import { formatCount, formatStreams } from "@/lib/format";
import { genreHref } from "@/lib/genres";
import type {
  CountryStat,
  DecadeStat,
  ListenerBand,
  GenreStat,
} from "@/lib/types";

/**
 * The charts page body.
 *
 * A Client Component because Recharts needs the DOM and because ChartCard
 * passes cell-render functions, which cannot cross the server boundary. The
 * page above it stays a Server Component and hands down plain rows.
 *
 * Every bar chart here measures **YouTube Music monthly listeners**, not
 * streams. That is the change the rebuild forced on this page: only the
 * original 500 artists have lifetime stream figures, so a stream-ranked
 * chart of a whole-archive view would be ranking genres by how thoroughly a
 * Kaggle CSV happened to cover them. Listener counts exist for every row.
 *
 * The archive score rides along in the table columns rather than as a second
 * axis. It is a 0-100 percentile and listener counts run to eight figures, so
 * putting both on one plot would need two scales - and a dual-axis chart lets
 * the author imply any correlation they like by choosing where the axes
 * cross. The table carries both without that risk.
 */
export function ChartsView({
  genres,
  countries,
  decades,
  listenerBands,
}: {
  genres: GenreStat[];
  countries: CountryStat[];
  decades: DecadeStat[];
  listenerBands: ListenerBand[];
}) {
  const genreRows = genres.map((g) => ({
    label: g.genre,
    value: Number(g.total_listeners),
    artists: g.artist_count,
    popularity: g.avg_popularity == null ? null : Number(g.avg_popularity),
    archived: g.archive_count,
    streams: g.total_streams_m == null ? null : Number(g.total_streams_m),
  }));

  // The country tail is long and mostly one artist per entry, which is a lot
  // of bars that say nothing. The table below still carries every one.
  const countryRows = countries.map((c) => ({
    label: c.country,
    value: Number(c.total_listeners),
    artists: c.artist_count,
    popularity: c.avg_popularity == null ? null : Number(c.avg_popularity),
    archived: c.archive_count,
  }));
  const topCountryRows = countryRows.slice(0, 12);

  const decadeRows = decades
    .slice()
    .sort((a, b) => a.decade - b.decade)
    .map((d) => ({
      label: `${d.decade}s`,
      artists: d.artist_count,
      value: Number(d.total_listeners),
      popularity: d.avg_popularity == null ? null : Number(d.avg_popularity),
    }));

  const bandRows = listenerBands
    .slice()
    .sort((a, b) => a.band - b.band)
    .map((b) => ({ label: b.label, artists: b.artist_count }));

  const totalBanded = bandRows.reduce((sum, r) => sum + r.artists, 0);

  /** "--" rather than 0 where a group has no artist with that figure. */
  const showScore = (v: number | null) => (v == null ? "--" : v.toFixed(1));

  return (
    <div className="space-y-8">
      <ChartCard
        title="YouTube Music listeners by genre"
        caption="Monthly listener counts summed across every artist filed under each canonical genre. Genre here is the archive's single-label classification: for the original 500 it is the dataset's own hand-applied label, and for a crawled artist it is the genre whose search found them."
        rows={genreRows}
        columns={[
          {
            header: "Genre",
            cell: (r) => (
              <Link
                href={genreHref(String(r.label))}
                className="hover:text-sw-cyan transition-colors"
              >
                {String(r.label)}
              </Link>
            ),
          },
          { header: "Artists", numeric: true, cell: (r) => String(r.artists) },
          {
            header: "Listeners",
            numeric: true,
            cell: (r) => formatCount(Number(r.value)),
          },
          {
            header: "Avg. archive score",
            numeric: true,
            cell: (r) => showScore(r.popularity as number | null),
          },
          {
            header: "Lifetime streams",
            numeric: true,
            // Only meaningful over the artists that have stream figures, and
            // the count of those is spelled out beside it rather than left
            // for the reader to assume it covers the whole genre.
            cell: (r) =>
              r.streams == null
                ? "--"
                : `${formatStreams(Number(r.streams))} (${r.archived})`,
          },
        ]}
      >
        <RankedBars data={genreRows} color="var(--chart-1)" />
      </ChartCard>

      <ChartCard
        title="Where the listeners are"
        caption="The twelve countries of origin with the most YouTube Music listeners behind them. The table lists all of them, including the long tail represented by a single artist. Country comes from the dataset for the original 500 and from MusicBrainz for everyone the crawl added."
        rows={countryRows}
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
          { header: "Artists", numeric: true, cell: (r) => String(r.artists) },
          {
            header: "Listeners",
            numeric: true,
            cell: (r) => formatCount(Number(r.value)),
          },
          {
            header: "Avg. archive score",
            numeric: true,
            cell: (r) => showScore(r.popularity as number | null),
          },
        ]}
      >
        <RankedBars data={topCountryRows} color="var(--chart-2)" />
      </ChartCard>

      <ChartCard
        title="How big is big"
        caption="Every artist in the archive, bucketed by YouTube Music monthly listeners. The bands are order-of-magnitude wide because the counts span five orders of magnitude - on a linear axis this would be one bar and a flat line. The long right tail is the point: a handful of artists hold audiences on a scale nobody else approaches, which is also why the archive score is a percentile rather than a share of the maximum."
        rows={bandRows}
        columns={[
          { header: "Monthly listeners", cell: (r) => String(r.label) },
          { header: "Artists", numeric: true, cell: (r) => String(r.artists) },
          {
            header: "Share of archive",
            numeric: true,
            cell: (r) =>
              totalBanded === 0
                ? "--"
                : `${((Number(r.artists) / totalBanded) * 100).toFixed(1)}%`,
          },
        ]}
      >
        <ListenerDistribution data={listenerBands} />
      </ChartCard>

      <ChartCard
        title="When they arrived"
        caption="Debut year by decade. The shape says as much about how the archive was assembled as about music: acts who debuted recently have had less time to build a following, and acts from before streaming existed are only here if their catalogue survived onto it. Artists with no known debut year are left out entirely."
        rows={decadeRows}
        columns={[
          { header: "Decade", cell: (r) => String(r.label) },
          {
            header: "Artists who debuted",
            numeric: true,
            cell: (r) => String(r.artists),
          },
          {
            header: "Listeners",
            numeric: true,
            cell: (r) => formatCount(Number(r.value)),
          },
          {
            header: "Avg. archive score",
            numeric: true,
            cell: (r) => showScore(r.popularity as number | null),
          },
        ]}
      >
        <DecadeChart data={decades} />
      </ChartCard>
    </div>
  );
}
