import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArtistAvatar } from "@/components/artist-avatar";
import {
  ArtistFeature,
  ArtistFeatureSkeleton,
} from "@/components/live/artist-feature";
import {
  ArtistPortrait,
  ArtistPortraitSkeleton,
} from "@/components/live/artist-portrait";
import {
  ArtistSignals,
  ArtistSignalsSkeleton,
} from "@/components/live/artist-signals";
import { SplitBar } from "@/components/split-bar";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  decadeLabel,
  formatPct,
  formatStreams,
  formatStreamsLong,
} from "@/lib/format";
import { getArtistBySlug, getRelatedArtists } from "@/lib/queries";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artist not found" };

  return {
    title: artist.name,
    description:
      `${artist.name} - ${artist.primary_genre} from ${artist.country}, ` +
      `debuted ${artist.debut_year}. Ranked #${artist.stream_rank} of 500 ` +
      `with ${formatStreams(artist.total_streams_m)} lifetime streams.`,
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const related = await getRelatedArtists(artist);

  const total = Number(artist.total_streams_m);
  const lead = Number(artist.lead_streams_m ?? 0);
  const feature = Number(artist.feature_streams_m ?? 0);
  const solo = Number(artist.solo_streams_m ?? 0);
  const collab = Number(artist.collab_streams_m ?? 0);
  const percentile = Math.round((1 - (artist.stream_rank - 1) / 500) * 100);

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/artists"
        className="text-sw-text-dim hover:text-sw-cyan inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to the archive
      </Link>

      {/* The masthead is split so the dataset half - name, badges, origin -
          paints with the server response, while the two pieces that depend on
          outbound API calls stream in behind their own boundaries. */}
      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="shrink-0">
          <Suspense fallback={<ArtistPortraitSkeleton />}>
            <ArtistPortrait artist={artist} />
          </Suspense>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-sw-pink/15 text-sw-pink border-sw-pink/40 border">
              #{artist.stream_rank} of 500
            </Badge>
            <Badge
              variant="outline"
              className="border-sw-cyan/40 text-sw-cyan bg-sw-cyan/10"
            >
              {artist.primary_genre}
            </Badge>
            <Badge variant="outline" className="border-sw-line text-sw-text-dim">
              {artist.artist_type}
            </Badge>
          </div>

          <h1 className="mt-3 text-4xl leading-tight font-bold sm:text-5xl">
            {artist.name}
          </h1>

          <p className="text-sw-text-dim mt-2 text-sm">
            {artist.country} &middot; sings in {artist.language} &middot;
            debuted <span className="tnum">{artist.debut_year}</span>
          </p>

          <Suspense fallback={<ArtistSignalsSkeleton />}>
            <ArtistSignals artist={artist} />
          </Suspense>
        </div>
      </header>

      <div className="mt-10">
        <Suspense fallback={<ArtistFeatureSkeleton />}>
          <ArtistFeature artist={artist} />
        </Suspense>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_18rem]">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold">By the numbers</h2>
            <Badge
              variant="outline"
              className="border-sw-amber/40 text-sw-amber bg-sw-amber/10 font-normal"
            >
              dataset snapshot
            </Badge>
          </div>
          <p className="text-sw-text-dim mt-1 text-sm">
            Lifetime totals as recorded in the source dataset. Every figure is
            a cumulative count, not a current rate.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              value={formatStreams(total)}
              label="total streams"
              hint={formatStreamsLong(total)}
              accent="pink"
            />
            <StatTile
              value={formatStreams(lead)}
              label="as lead artist"
              hint={formatStreamsLong(lead)}
              accent="cyan"
            />
            <StatTile
              value={formatStreams(feature)}
              label="as a feature"
              hint={formatStreamsLong(feature)}
              accent="amber"
            />
            <StatTile
              value={`#${artist.stream_rank}`}
              label={`top ${100 - percentile + 1}% of the archive`}
              accent="mint"
            />
          </div>

          <div className="mt-8 space-y-6">
            <SplitBar
              title="Lead versus featured"
              caption="Streams on tracks billed to them, against streams on someone else's track they appear on."
              segments={[
                { label: "Lead", value: lead, color: "var(--chart-2)" },
                { label: "Feature", value: feature, color: "var(--chart-3)" },
              ]}
            />

            <SplitBar
              title="Solo versus collaborative"
              caption="Streams on tracks they are the only credited artist on, against everything with a second name on it."
              segments={[
                { label: "Solo", value: solo, color: "var(--chart-4)" },
                {
                  label: "Collaborative",
                  value: collab,
                  color: "var(--chart-1)",
                },
              ]}
            />
          </div>

          <Card className="sw-card mt-8">
            <CardContent className="px-5">
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                Where they sit
              </h3>
              <Separator className="bg-sw-line/60 my-4" />

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <Fact label="Archive rank">
                  <span className="tnum">#{artist.stream_rank}</span> of 500
                </Fact>
                <Fact label="Primary genre">{artist.primary_genre}</Fact>
                <Fact label="Country of origin">{artist.country}</Fact>
                <Fact label="Primary language">{artist.language}</Fact>
                <Fact label="Act type">{artist.artist_type}</Fact>
                <Fact label="Debut">
                  <span className="tnum">{artist.debut_year}</span> (
                  {decadeLabel(artist.debut_year)})
                </Fact>
                <Fact label="Solo share">
                  <span className="tnum">{formatPct(artist.solo_pct)}</span>
                </Fact>
                <Fact label="Collaborative share">
                  <span className="tnum">{formatPct(artist.collab_pct)}</span>
                </Fact>
                <Fact label="Listed as">{artist.sex}</Fact>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-sw-amber/30 bg-sw-amber/5">
            <CardContent className="px-5">
              <h3 className="text-sw-amber text-sm font-semibold tracking-wide uppercase">
                Two clocks
              </h3>
              <p className="text-sw-text-dim mt-3 text-sm leading-relaxed">
                The track, photo, follower count and genre tags above are
                fetched live. The stream totals are frozen at whenever the
                dataset was compiled, so treat them as history, not as
                today&rsquo;s number.
              </p>
              <Link
                href="/about"
                className="text-sw-amber hover:text-sw-amber/80 mt-3 inline-block text-xs underline underline-offset-2 transition-colors"
              >
                More on the sources
              </Link>
            </CardContent>
          </Card>

          {related.length > 0 && (
            <Card className="sw-card">
              <CardContent className="px-5">
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  More {artist.primary_genre}
                </h3>
                <Separator className="bg-sw-line/60 my-4" />

                <ul className="space-y-3">
                  {related.map((other) => (
                    <li key={other.id}>
                      <Link
                        href={`/artists/${other.slug}`}
                        className="group flex items-center gap-3"
                      >
                        <ArtistAvatar
                          name={other.name}
                          className="size-9 shrink-0 rounded-md text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="group-hover:text-sw-cyan truncate text-sm transition-colors">
                            {other.name}
                          </p>
                          <p className="tnum text-sw-text-dim text-xs">
                            {formatStreams(other.total_streams_m)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </article>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sw-text-dim/80 text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
