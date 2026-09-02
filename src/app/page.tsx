import { ArrowRight, BarChart3, Play } from "lucide-react";
import Link from "next/link";

import { ArtistAvatar } from "@/components/artist-avatar";
import { ArtistCard } from "@/components/artist-card";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPct, formatStreams } from "@/lib/format";
import {
  getArchiveSummary,
  getGenreStats,
  getTopArtists,
} from "@/lib/queries";

// The dataset is static; an hour-old page is fine and keeps Supabase reads low.
export const revalidate = 3600;

export default async function HomePage() {
  const [summary, topArtists, genres] = await Promise.all([
    getArchiveSummary(),
    getTopArtists(13),
    getGenreStats(),
  ]);

  const [featured, ...rest] = topArtists;
  const topGenres = genres.slice(0, 6);
  const biggestGenre = topGenres[0];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
          <p className="text-sw-cyan sw-glow-cyan text-xs font-medium tracking-[0.3em] uppercase">
            A streaming archive
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-bold sm:text-6xl">
            <span className="text-sw-pink sw-glow-pink">500 artists</span>,
            <br />
            sorted by how much
            <br />
            the world pressed play.
          </h1>

          <p className="text-sw-text-dim mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
            Lifetime stream totals, solo-versus-collaboration splits and debut
            years from a Kaggle dataset &mdash; paired with each artist&rsquo;s
            biggest track right now, their genre tags and a short description
            pulled live from Deezer, Apple Music and Wikipedia.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/artists">
                Browse the archive
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/charts">
                <BarChart3 className="size-4" />
                See the charts
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              value={summary.artistCount.toLocaleString("en-US")}
              label="artists"
              accent="pink"
            />
            <StatTile
              value={formatStreams(summary.totalStreamsM)}
              label="streams, combined"
              hint={`${Math.round(summary.totalStreamsM).toLocaleString("en-US")} million`}
              accent="cyan"
            />
            <StatTile
              value={String(summary.countryCount)}
              label="countries"
              accent="amber"
            />
            <StatTile
              value={`${summary.earliestDebut}–${summary.latestDebut}`}
              label="debut years"
              accent="mint"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="sw-rule" />
      </div>

      {/* -------------------------------------------------------- featured */}
      {featured && (
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
          <p className="text-sw-text-dim text-xs font-medium tracking-[0.3em] uppercase">
            Top of the archive
          </p>

          <Card className="sw-card mt-5 overflow-hidden p-0">
            <Link href={`/artists/${featured.slug}`} className="group block">
              <CardContent className="flex flex-col gap-8 p-6 sm:p-8 md:flex-row md:items-center">
                <ArtistAvatar
                  name={featured.name}
                  className="size-28 shrink-0 rounded-xl text-3xl sm:size-36 sm:text-4xl"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-sw-pink/15 text-sw-pink border-sw-pink/40 border">
                      #1 of {summary.artistCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-sw-cyan/40 text-sw-cyan bg-sw-cyan/10"
                    >
                      {featured.primary_genre}
                    </Badge>
                  </div>

                  <h2 className="group-hover:text-sw-pink mt-4 text-3xl font-bold transition-colors sm:text-5xl">
                    {featured.name}
                  </h2>

                  <p className="text-sw-text-dim mt-3 text-sm leading-relaxed sm:text-base">
                    Debuted in {featured.debut_year} out of {featured.country},
                    and has since taken{" "}
                    <span className="text-sw-text tnum font-medium">
                      {formatStreams(featured.total_streams_m)}
                    </span>{" "}
                    streams &mdash;{" "}
                    <span className="tnum">
                      {formatPct(featured.collab_pct, 0)}
                    </span>{" "}
                    of them on tracks shared with someone else.
                  </p>

                  <span className="text-sw-cyan mt-5 inline-flex items-center gap-2 text-sm font-medium">
                    <Play className="size-4 fill-current" aria-hidden="true" />
                    Play their biggest track
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </CardContent>
            </Link>
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------ feed + rail */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">The rest of the top 13</h2>
                <p className="text-sw-text-dim mt-1 text-sm">
                  Ranked by lifetime streams across the whole dataset.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/artists">
                  All 500
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {rest.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </div>

          {/* ---------------------------------------------------- sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="sw-card">
              <CardContent className="px-5">
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  Biggest genres
                </h3>
                <Separator className="bg-sw-line/60 my-4" />

                <ul className="space-y-3">
                  {topGenres.map((genre) => {
                    const share =
                      (Number(genre.total_streams_m) /
                        Number(biggestGenre.total_streams_m)) *
                      100;

                    return (
                      <li key={genre.genre}>
                        <Link
                          href={`/artists?genre=${encodeURIComponent(genre.genre)}`}
                          className="group block"
                        >
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="group-hover:text-sw-cyan truncate transition-colors">
                              {genre.genre}
                            </span>
                            <span className="tnum text-sw-text-dim shrink-0 text-xs">
                              {formatStreams(genre.total_streams_m)}
                            </span>
                          </div>
                          <div className="bg-sw-surface-2 mt-1.5 h-1 overflow-hidden rounded-full">
                            <div
                              className="bg-sw-cyan/70 group-hover:bg-sw-cyan h-full transition-colors"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-sw-amber/30 bg-sw-amber/5">
              <CardContent className="px-5">
                <h3 className="text-sw-amber text-sm font-semibold tracking-wide uppercase">
                  On the numbers
                </h3>
                <p className="text-sw-text-dim mt-3 text-sm leading-relaxed">
                  Stream totals here are a fixed snapshot from the source
                  dataset, so they trail today&rsquo;s real figures &mdash;
                  no streaming service publishes live per-artist lifetime
                  counts. Track names, artwork and genre tags <em>are</em>
                  live.
                </p>
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="text-sw-amber mt-2 h-auto p-0"
                >
                  <Link href="/about">Read the caveats</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </>
  );
}
