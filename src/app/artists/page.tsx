import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ArchiveFilters } from "@/components/archive-filters";
import { ArtistCard } from "@/components/artist-card";
import { StaggerReveal } from "@/components/motion/stagger-reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getArchiveSummary,
  getArtists,
  getFilterOptions,
  type ArtistFilters,
  type ArtistSort,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "The archive",
  description:
    "Every artist in the archive, ranked by how big they are right now, and " +
    "filterable by genre, country and act type.",
};

export const revalidate = 3600;

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const sortParam = first(sp.sort);
  const SORTS: ArtistSort[] = [
    "popularity",
    "listeners",
    "streams",
    "name",
    "debut",
    "collab",
  ];
  const sort: ArtistSort = SORTS.includes(sortParam as ArtistSort)
    ? (sortParam as ArtistSort)
    : "popularity";

  const filters: ArtistFilters = {
    search: first(sp.q),
    genre: first(sp.genre),
    country: first(sp.country),
    artistType: first(sp.type),
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [{ artists, total }, options, summary] = await Promise.all([
    getArtists(filters),
    getFilterOptions(),
    getArchiveSummary(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : filters.offset! + 1;
  const to = Math.min(filters.offset! + PAGE_SIZE, total);

  /** Same query string, different page. */
  function pageHref(target: number): string {
    const next = new URLSearchParams();
    if (filters.search) next.set("q", filters.search);
    if (filters.genre) next.set("genre", filters.genre);
    if (filters.country) next.set("country", filters.country);
    if (filters.artistType) next.set("type", filters.artistType);
    if (sort !== "popularity") next.set("sort", sort);
    if (target > 1) next.set("page", String(target));

    const qs = next.toString();
    return qs ? `/artists?${qs}` : "/artists";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="text-sw-cyan text-xs font-medium tracking-[0.3em] uppercase">
          The archive
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Every artist in the set
        </h1>
        <p className="text-sw-text-dim mt-3 max-w-2xl leading-relaxed">
          {summary.artistCount.toLocaleString("en-US")} acts, ranked by live
          YouTube Music monthly listeners. {summary.archiveCount} of them also
          carry the original dataset&rsquo;s lifetime stream figures. Open any
          one of them to hear the tracks they are biggest for right now.
        </p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-9 w-full max-w-3xl" />}>
          <ArchiveFilters
            genres={options.genres}
            countries={options.countries}
            artistCount={summary.artistCount}
          />
        </Suspense>
      </div>

      <p className="text-sw-text-dim mt-6 text-sm">
        {total === 0 ? (
          "No matches"
        ) : (
          <>
            Showing <span className="tnum">{from}</span>&ndash;
            <span className="tnum">{to}</span> of{" "}
            <span className="tnum">{total}</span>
          </>
        )}
      </p>

      {artists.length === 0 ? (
        <div className="border-sw-line/60 mt-8 flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center">
          <SearchX
            className="text-sw-text-dim mb-4 size-8"
            aria-hidden="true"
          />
          <p className="font-medium">Nothing matches those filters.</p>
          <p className="text-sw-text-dim mt-1 text-sm">
            Try widening the genre or country, or clear the search box.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-5">
            <Link href="/artists">Reset filters</Link>
          </Button>
        </div>
      ) : (
        <StaggerReveal className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </StaggerReveal>
      )}

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
