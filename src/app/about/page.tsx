import { AlertTriangle, Database, Radio } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "Where every number on this site comes from, which parts are live and " +
    "which are a fixed historical snapshot, and how the two are separated.",
};

const COLUMNS = [
  ["Artist Name", "name, slug", "Primary key of every URL on the site."],
  ["Sex", "sex", "Listed as Male, Female or Mixed for groups."],
  ["Country of Origin", "country", "43 distinct values."],
  ["Primary Language", "language", "11 distinct values."],
  ["Primary Genre", "primary_genre", "One label per artist; 23 values."],
  ["Artist Type", "artist_type", "Solo or Group."],
  ["Debut Year", "debut_year", "Ranges from 1939 to 2023."],
  [
    "Total Streams (in millions)",
    "total_streams_m",
    "Cumulative lifetime plays. Drives the archive ranking.",
  ],
  [
    "Lead Streams (in millions)",
    "lead_streams_m",
    "Plays on tracks billed to this artist.",
  ],
  [
    "Feature Streams (in millions)",
    "feature_streams_m",
    "Plays on other artists' tracks they appear on.",
  ],
  [
    "Solo Streams (in millions)",
    "solo_streams_m",
    "Plays on tracks with no other credited artist.",
  ],
  ["% of Solo Streams", "solo_pct", "Derived share, carried over as given."],
  [
    "Collaborative Streams (in millions)",
    "collab_streams_m",
    "Plays on tracks with a second credited artist.",
  ],
  ["% of Collaborative Streams", "collab_pct", "Derived share."],
  [
    "(derived)",
    "stream_rank",
    "1-500 by total streams, computed once at load time.",
  ],
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-sw-cyan text-xs font-medium tracking-[0.3em] uppercase">
          About the data
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Two clocks, one page
        </h1>
        <p className="text-sw-text-dim mt-4 text-lg leading-relaxed">
          Every artist page mixes a frozen dataset with live API calls. Those
          two things age very differently, so this page says exactly which is
          which &mdash; and which artists have both.
        </p>
      </header>

      {/* ------------------------------------------------------- the caveat */}
      <Card className="border-sw-amber/40 bg-sw-amber/5 mt-10">
        <CardContent className="px-5">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="text-sw-amber mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sw-amber text-base font-semibold">
                The stream totals are not 2026 numbers
              </h2>
              <div className="text-sw-text-dim mt-3 space-y-3 text-sm leading-relaxed">
                <p>
                  The dataset is a snapshot taken when it was compiled, and
                  every stream figure in it is a cumulative lifetime count as of
                  that moment. Real totals have only gone up since. An artist
                  who has released a hit record since the snapshot is
                  undercounted here, and one who has been quiet is closer to
                  accurate.
                </p>
                <p>
                  There is no way to refresh those numbers. No streaming service
                  publishes per-artist lifetime stream counts through a public
                  API &mdash; the closest anyone offers is a popularity or
                  ranking signal, which measures recent play volume rather than
                  a total. So the historical figures here cannot be brought up
                  to date from any source.
                </p>
                <p className="text-sw-text">
                  So: read the stream totals as a snapshot of how one group of
                  artists compared to each other at one point in time, not as a
                  leaderboard of today. The archive is no longer ranked on them
                  &mdash; it is ranked on live YouTube Music monthly listeners,
                  which is a measure of listening rather than of lifetime plays,
                  and the two disagree often.
                </p>
                <p>
                  Only the 500 artists from the original dataset have stream
                  figures at all. Everyone else reached the archive through a
                  Spotify genre search, and their pages say so.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------------- what is which */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Which half is which</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="sw-card">
            <CardContent className="px-5">
              <div className="flex items-center gap-2">
                <Database className="text-sw-cyan size-4" aria-hidden="true" />
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  Frozen
                </h3>
              </div>
              <ul className="text-sw-text-dim mt-3 space-y-1.5 text-sm">
                <li>Total, lead, feature, solo and collaborative streams</li>
                <li>All-time stream rank (#1&ndash;500)</li>
                <li>Primary language</li>
                <li>
                  Genre, country, act type and debut year for the original 500
                </li>
              </ul>
              <p className="text-sw-text-dim/70 mt-4 text-xs">
                Loaded into Supabase once from the CSV, then read from Postgres.
                Absent entirely for artists the crawl added.
              </p>
            </CardContent>
          </Card>

          <Card className="sw-card">
            <CardContent className="px-5">
              <div className="flex items-center gap-2">
                <Radio className="text-sw-pink size-4" aria-hidden="true" />
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  Live
                </h3>
              </div>
              <ul className="text-sw-text-dim mt-3 space-y-1.5 text-sm">
                <li>
                  YouTube Music monthly listeners, and the rank and archive
                  score drawn from them
                </li>
                <li>
                  The artist&rsquo;s top 5 tracks on YouTube Music, and the
                  player
                </li>
                <li>The 30-second preview audio you hear</li>
                <li>MusicBrainz subgenre tags</li>
                <li>Album artwork and artist photo</li>
                <li>The description from Wikipedia</li>
              </ul>
              <p className="text-sw-text-dim/70 mt-4 text-xs">
                Listener counts, tracks and subgenres are written by the offline
                pipeline. The preview audio, artwork and description are fetched
                on first view and cached for seven days.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------- provenance */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Sources</h2>
        <dl className="mt-6 space-y-5">
          <Source
            name="Spotify Music Artist Streaming Analytics"
            kind="Kaggle dataset"
            body="500 artists across 14 columns, with no missing values. Supplies every historical figure on the site, and nothing that is current."
          />
          <Source
            name="Spotify Web API"
            kind="Spotipy, client credentials - portraits and discovery"
            body="Reached through Spotipy, the official Python client for the Spotify Web API. Used for artist portraits, and for the genre searches that find acts the Kaggle dataset never listed. It is deliberately NOT the ranking source: in February 2026 Spotify removed followers, popularity and genres from the artist object for apps in Developer Mode, and made the artist top-tracks endpoint return 403. Those fields now require Extended Quota Mode, which is granted by application. So Spotify proposes artists and YouTube Music scores them."
          />
          <Source
            name="YouTube Music"
            kind="unofficial client (ytmusicapi) - the ranking and the tracks"
            body="Two jobs, both from one lookup per artist. It publishes a monthly-listeners figure, which is what the archive is ranked on and what the 0-100 archive score is a percentile of; and its own 'top releases' shelf, already ordered by popularity, which is where the artist's top 5 tracks come from. The preview above each player is 30 seconds; the YouTube Music link under it is the whole record, free and without an account, which is the reason it is there. Resolved offline because the official YouTube Data API allows 10,000 quota units a day and charges 100 per search - about 100 artists."
          />
          <Source
            name="MusicBrainz"
            kind="no credentials - origin and subgenres"
            body="Country of origin, act type and curated subgenre tags for artists that arrived through the crawl. Neither Spotify nor YouTube Music reports any of these, so without this backfill the country chart and the subgenre badges on an artist page would cover only what each act's own scattered metadata happened to include. Capped at one request a second, which is why it runs offline and is this pipeline's slowest pass."
          />
          <Source
            name="iTunes Search API"
            kind="Apple, no credentials - the audio"
            body="Supplies the permanent, non-expiring 30-second preview file for each of the tracks YouTube Music has already chosen - up to five per artist, looked up in parallel. Apple's preview URLs carry no signature and no expiry, so once fetched they stay good for as long as the cached row does."
          />
          <Source
            name="Wikipedia"
            kind="REST + Action API"
            body="The one-paragraph description on each artist page. Resolving the right article is the hard part: a bare name lands on a colour for Pink and a disambiguation page for Drake, so a candidate is only accepted if its title plausibly refers to the artist and its summary reads like it is about a musician."
          />
        </dl>
      </section>

      {/* ------------------------------------------------------ the columns */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Every column, and where it went</h2>
        <p className="text-sw-text-dim mt-2 text-sm">
          The CSV headers map onto{" "}
          <code className="bg-sw-surface-2 rounded px-1.5 py-0.5 text-xs">
            public.artists
          </code>{" "}
          like this.
        </p>

        <div className="mt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-sw-line/60 hover:bg-transparent">
                <TableHead>CSV column</TableHead>
                <TableHead>Database column</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COLUMNS.map(([csv, db, note]) => (
                <TableRow
                  key={db}
                  className="border-sw-line/40 hover:bg-sw-surface-2/40"
                >
                  <TableCell className="text-sw-text-dim">{csv}</TableCell>
                  <TableCell>
                    <code className="text-sw-cyan text-xs">{db}</code>
                  </TableCell>
                  <TableCell className="text-sw-text-dim text-sm">
                    {note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ------------------------------------------------------------ build */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">How it is built</h2>
        <div className="text-sw-text-dim mt-4 space-y-3 leading-relaxed">
          <p>
            Next.js on Vercel, with Supabase Postgres behind it. The interface
            is shadcn/ui, re-themed by pointing its design tokens at
            daisyUI&rsquo;s valentine palette rather than by restyling
            components one at a time.
          </p>
          <p>
            Aggregates for the{" "}
            <Link
              href="/charts"
              className="text-sw-cyan hover:text-sw-cyan/80 underline underline-offset-2 transition-colors"
            >
              charts
            </Link>{" "}
            are SQL views, so Postgres does the grouping and no page ever pulls
            500 rows across the wire to count them in JavaScript. Row-level
            security gives the public key read access and nothing else; the
            live-profile cache is written with a server-side service key.
          </p>
          <p className="text-sw-text-dim/80 text-sm">
            This is a coursework project and is not affiliated with, endorsed
            by, or connected to Apple, Spotify or YouTube.
          </p>
        </div>
      </section>
    </div>
  );
}

function Source({
  name,
  kind,
  body,
}: {
  name: string;
  kind: string;
  body: string;
}) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name}</span>
        <Badge
          variant="outline"
          className="border-sw-line text-sw-text-dim font-normal"
        >
          {kind}
        </Badge>
      </dt>
      <dd className="text-sw-text-dim mt-1.5 text-sm leading-relaxed">
        {body}
      </dd>
      <Separator className="bg-sw-line/40 mt-5" />
    </div>
  );
}
