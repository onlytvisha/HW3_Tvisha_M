import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtistCard } from "@/components/artist-card";
import { StaggerReveal } from "@/components/motion/stagger-reveal";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { formatCount, formatStreams } from "@/lib/format";
import { genreFromSlug } from "@/lib/genres";
import { getArtists, getGenreStat, getGenreStats } from "@/lib/queries";

export const revalidate = 3600;

const PAGE_SIZE = 24;

/**
 * Rendered on demand, not prerendered.
 *
 * This route reads `searchParams` for the page number, and any page that does
 * is dynamic - so a `generateStaticParams` here would return all 23 slugs and
 * prerender none of them. (Checked, rather than assumed: with one in place the
 * build emitted `genres.html` for the index and no HTML at all for the slugs.)
 *
 * Paging is worth more than prerendering here. A large genre runs to hundreds
 * of artists, and `revalidate` above still lets the full route cache serve a
 * given page for an hour.
 */

/** The label this slug belongs to, resolved against the real genre list. */
async function resolveGenre(slug: string): Promise<string | undefined> {
  const genres = await getGenreStats();
  return genreFromSlug(
    slug,
    genres.map((g) => g.genre),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = await resolveGenre(slug);
  if (!genre) return { title: "Genre not found" };

  const stat = await getGenreStat(genre);
  return {
    title: genre,
    description:
      `Every ${genre} artist in the archive` +
      (stat
        ? ` - ${stat.artist_count} acts, ranked by how big they are right now.`
        : "."),
  };
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const genre = await resolveGenre(slug);
  if (!genre) notFound();

  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);

  const [stat, { artists, total }] = await Promise.all([
    getGenreStat(genre),
    getArtists({
      genre,
      sort: "popularity",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (target: number) =>
    target > 1 ? `/genres/${slug}?page=${target}` : `/genres/${slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/genres"
        className="text-sw-text-dim hover:text-sw-cyan inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        All genres
      </Link>

      <header className="mt-6">
        <p className="text-sw-cyan text-xs font-medium tracking-[0.3em] uppercase">
          Genre
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{genre}</h1>
        <p className="text-sw-text-dim mt-3 max-w-2xl leading-relaxed">
          {total === 1 ? "One artist is" : `${total} artists are`} filed under{" "}
          {genre}, ranked by how big they are right now. Open any of them to
          hear the track they are biggest for.
        </p>
      </header>

      {stat && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            value={String(stat.artist_count)}
            label="artists"
            accent="pink"
          />
          <StatTile
            value={formatCount(Number(stat.total_listeners))}
            label="YouTube Music listeners, combined"
            accent="cyan"
          />
          <StatTile
            value={
              stat.avg_popularity == null
                ? "--"
                : Number(stat.avg_popularity).toFixed(0)
            }
            label="average archive score"
            hint="Each artist's monthly listeners as a percentile of the whole archive, averaged across this genre"
            accent="amber"
          />
          {/* Only shown when the genre actually has dataset artists in it -
              a genre made entirely of crawled artists has no stream figures,
              and a "0" here would read as "nobody listens to this". */}
          {stat.archive_count > 0 && stat.total_streams_m != null ? (
            <StatTile
              value={formatStreams(Number(stat.total_streams_m))}
              label="lifetime streams"
              hint={`Summed over the ${stat.archive_count} artists in this genre with dataset figures`}
              accent="mint"
            />
          ) : (
            <StatTile
              value={
                stat.peak_popularity == null
                  ? "--"
                  : String(stat.peak_popularity)
              }
              label="peak archive score"
              hint="The highest archive score in this genre"
              accent="mint"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/artists?genre=${encodeURIComponent(genre)}`}>
            <SlidersHorizontal className="size-3.5" />
            Filter these by country and act type
          </Link>
        </Button>
      </div>

      <StaggerReveal className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </StaggerReveal>

      {pageCount > 1 && (
        <nav
          className="mt-10 flex items-center justify-between gap-4"
          aria-label="Pagination"
        >
          <Button
            asChild={page > 1}
            variant="outline"
            size="sm"
            disabled={page <= 1}
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)}>
                <ChevronLeft className="size-4" />
                Previous
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4" />
                Previous
              </span>
            )}
          </Button>

          <span className="tnum text-sw-text-dim text-sm">
            Page {page} of {pageCount}
          </span>

          <Button
            asChild={page < pageCount}
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
          >
            {page < pageCount ? (
              <Link href={pageHref(page + 1)}>
                Next
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span>
                Next
                <ChevronRight className="size-4" />
              </span>
            )}
          </Button>
        </nav>
      )}
    </div>
  );
}
