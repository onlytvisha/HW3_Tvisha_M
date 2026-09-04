import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { hasArchiveStats } from "@/lib/artists";
import {
  decadeLabel,
  formatCount,
  formatPct,
  formatStreams,
  formatStreamsLong,
} from "@/lib/format";
import { genreHref } from "@/lib/genres";
import {
  getArchiveSummary,
  getArtistBySlug,
  getRelatedArtists,
} from "@/lib/queries";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artist not found" };

  const where = [artist.primary_genre, artist.country]
    .filter(Boolean)
    .join(" from ");
  const rank =
    artist.popularity_rank != null
      ? ` Ranked #${artist.popularity_rank} in the archive right now`
      : "";

  return {
    title: artist.name,
    description:
      `${artist.name}${where ? ` - ${where}` : ""}.${rank}` +
      (artist.monthly_listeners != null
        ? ` with ${formatCount(artist.monthly_listeners)} YouTube Music listeners.`
        : "."),
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

  const [related, summary] = await Promise.all([
    getRelatedArtists(artist),
    getArchiveSummary(),
  ]);

  const archived = hasArchiveStats(artist);
  const total = Number(artist.total_streams_m ?? 0);
  const lead = Number(artist.lead_streams_m ?? 0);
  const feature = Number(artist.feature_streams_m ?? 0);
  const solo = Number(artist.solo_streams_m ?? 0);
  const collab = Number(artist.collab_streams_m ?? 0);

  // Against the whole archive, not a hardcoded 500 - the table is however big
  // the last pipeline run left it.
  const size = summary.artistCount || 1;
  const percentile =
    artist.popularity_rank != null
      ? Math.max(1, Math.round((artist.popularity_rank / size) * 100))
      : null;

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
            {artist.popularity_rank != null && (
              <Badge className="bg-sw-pink/15 text-sw-pink border-sw-pink/40 border">
                #{artist.popularity_rank} of{" "}
                {summary.artistCount.toLocaleString("en-US")} right now
              </Badge>
            )}

            {/* The genre badge is a link: it is the one word on this page that
                describes a group rather than this artist, so it should lead to
                the group. */}
            {artist.primary_genre && (
              <Link
                href={genreHref(artist.primary_genre)}
                className="focus-visible:ring-ring/60 rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge
                  variant="outline"
                  className="border-sw-cyan/40 text-sw-cyan bg-sw-cyan/10 hover:bg-sw-cyan/20 gap-1 transition-colors"
                >
                  {artist.primary_genre}
                  <ChevronRight className="size-3" aria-hidden="true" />
                </Badge>
              </Link>
            )}

            {artist.artist_type && (
              <Badge
                variant="outline"
                className="border-sw-line text-sw-text-dim"
              >
                {artist.artist_type}
              </Badge>
            )}

            {!archived && (
              <Badge
                variant="outline"
                className="border-sw-amber/40 text-sw-amber bg-sw-amber/10 font-normal"
                title="Found through Spotify rather than the original Kaggle dataset, so the historical stream figures do not exist for them"
              >
                live entry
              </Badge>
            )}
          </div>

          <h1 className="mt-3 text-4xl leading-tight font-bold sm:text-5xl">
            {artist.name}
          </h1>

          <p className="text-sw-text-dim mt-2 text-sm">
            {[
              artist.country,
              artist.language ? `sings in ${artist.language}` : null,
              artist.debut_year ? `debuted ${artist.debut_year}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
          {/* ------------------------------------------------ live figures */}
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold">Right now</h2>
            <Badge
              variant="outline"
              className="border-sw-mint/40 text-sw-mint bg-sw-mint/10 font-normal"
            >
              live from YouTube Music
            </Badge>
          </div>
          <p className="text-sw-text-dim mt-1 text-sm">
            How many people listen to {artist.name} on YouTube Music each month,
            and where that puts them against everyone else in the archive. The
            score is this archive&rsquo;s own &mdash; a percentile of that
            listener count, not a number YouTube Music itself publishes.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              value={formatCount(artist.monthly_listeners)}
              label="YouTube Music listeners"
              hint={
                artist.monthly_listeners != null
                  ? `${artist.monthly_listeners.toLocaleString("en-US")} monthly listeners`
                  : undefined
              }
              accent="pink"
            />
            <StatTile
              value={
                artist.popularity_rank != null
                  ? `#${artist.popularity_rank}`
                  : "--"
              }
              label={
                percentile != null
                  ? `top ${percentile}% of the archive`
                  : "unranked"
              }
              accent="cyan"
            />
            <StatTile
              value={artist.popularity != null ? `${artist.popularity}` : "--"}
              label="archive score, 0-100"
              hint="This artist's monthly listeners as a percentile of the archive: 100 is the most-listened-to act here, 50 the median."
              accent="amber"
            />
          </div>

          {/* --------------------------------------- the frozen dataset */}
          {archived ? (
            <>
              <div className="mt-12 flex items-baseline gap-3">
                <h2 className="text-2xl font-bold">In the dataset</h2>
                <Badge
                  variant="outline"
                  className="border-sw-amber/40 text-sw-amber bg-sw-amber/10 font-normal"
                >
                  historical snapshot
                </Badge>
              </div>
              <p className="text-sw-text-dim mt-1 text-sm">
                Lifetime totals as recorded when the Kaggle dataset was
                compiled. Cumulative counts, frozen &mdash; not a current rate,
                and not comparable with the live figures above.
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
                  value={
                    artist.stream_rank != null ? `#${artist.stream_rank}` : "--"
                  }
                  label="all-time rank, of 500"
                  accent="mint"
                />
              </div>

              <div className="mt-8 space-y-6">
                <SplitBar
                  title="Lead versus featured"
                  caption="Streams on tracks billed to them, against streams on someone else's track they appear on."
                  segments={[
                    { label: "Lead", value: lead, color: "var(--chart-2)" },
                    {
                      label: "Feature",
                      value: feature,
                      color: "var(--chart-3)",
                    },
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
                      // chart-5, not chart-1: slots 4 and 1 are the one pair in
                      // the ramp that collapses under deuteranopia (dE 5.6),
                      // and this bar puts them directly against each other.
                      // 4 against 5 separates cleanly (dE 21.3).
                      color: "var(--chart-5)",
                    },
                  ]}
                />
              </div>
            </>
          ) : (
            <Card className="border-sw-line/60 mt-12 border-dashed bg-transparent">
              <CardContent className="px-5">
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  No historical figures
                </h2>
                <p className="text-sw-text-dim mt-3 text-sm leading-relaxed">
                  {artist.name} came into the archive through Spotify rather
                  than the Kaggle dataset, so there are no lifetime stream
                  totals or solo-versus-collaborative splits for them. No
                  streaming service publishes a per-artist lifetime play count
                  through a public API, so these cannot be filled in &mdash;
                  only the 500 acts the dataset covered have them.
                </p>
                <Link
                  href="/about"
                  className="text-sw-cyan hover:text-sw-cyan/80 mt-3 inline-block text-xs underline underline-offset-2 transition-colors"
                >
                  How the two halves of the archive differ
                </Link>
              </CardContent>
            </Card>
          )}

          <Card className="sw-card mt-8">
            <CardContent className="px-5">
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                Where they sit
              </h3>
              <Separator className="bg-sw-line/60 my-4" />

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <Fact label="Live rank">
                  {artist.popularity_rank != null ? (
                    <>
                      <span className="tnum">#{artist.popularity_rank}</span> of{" "}
                      {summary.artistCount.toLocaleString("en-US")}
                    </>
                  ) : (
                    "--"
                  )}
                </Fact>
                <Fact label="Primary genre">
                  {artist.primary_genre ? (
                    <Link
                      href={genreHref(artist.primary_genre)}
                      className="hover:text-sw-cyan underline-offset-2 transition-colors hover:underline"
                    >
                      {artist.primary_genre}
                    </Link>
                  ) : (
                    "--"
                  )}
                </Fact>
                <Fact label="Country of origin">{artist.country ?? "--"}</Fact>
                <Fact label="Primary language">{artist.language ?? "--"}</Fact>
                <Fact label="Act type">{artist.artist_type ?? "--"}</Fact>
                <Fact label="Debut">
                  {artist.debut_year != null ? (
                    <>
                      <span className="tnum">{artist.debut_year}</span> (
                      {decadeLabel(artist.debut_year)})
                    </>
                  ) : (
                    "--"
                  )}
                </Fact>
                <Fact label="Solo share">
                  <span className="tnum">{formatPct(artist.solo_pct)}</span>
                </Fact>
                <Fact label="Collaborative share">
                  <span className="tnum">{formatPct(artist.collab_pct)}</span>
                </Fact>
                <Fact label="Listed as">{artist.sex ?? "--"}</Fact>
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
                The listener count, archive score, tracks, photo and genre tags
                above are fetched live. Any stream totals are frozen at whenever
                the dataset was compiled, so treat those as history, not as
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

          {related.length > 0 && artist.primary_genre && (
            <Card className="sw-card">
              <CardContent className="px-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-wide uppercase">
                    More {artist.primary_genre}
                  </h3>
                  <Link
                    href={genreHref(artist.primary_genre)}
                    className="text-sw-cyan hover:text-sw-cyan/80 shrink-0 text-xs transition-colors"
                  >
                    See all
                  </Link>
                </div>
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
                          imageUrl={other.image_url}
                          className="size-9 shrink-0 rounded-md text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="group-hover:text-sw-cyan truncate text-sm transition-colors">
                            {other.name}
                          </p>
                          <p className="tnum text-sw-text-dim text-xs">
                            {formatCount(other.monthly_listeners)} listeners
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
