import { ArrowUpRight, Globe2, Users } from "lucide-react";
import Link from "next/link";

import { ArtistAvatar } from "@/components/artist-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPct, formatStreams, formatStreamsLong } from "@/lib/format";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One entry in the archive feed - the blog-post card of this layout, where
 * the artist is the post, their genre is the category and their debut year
 * is the dateline.
 */
export function ArtistCard({
  artist,
  className,
}: {
  artist: Artist;
  className?: string;
}) {
  const collab = Number(artist.collab_pct ?? 0);

  return (
    <Card
      className={cn(
        "sw-card group relative gap-0 overflow-hidden p-0",
        className,
      )}
    >
      <Link
        href={`/artists/${artist.slug}`}
        className="flex h-full flex-col focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-start gap-4 p-5">
          <ArtistAvatar
            name={artist.name}
            className="size-14 shrink-0 rounded-lg text-lg"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="group-hover:text-sw-pink truncate text-lg leading-tight font-semibold transition-colors">
                {artist.name}
              </h3>
              <span
                className="tnum text-sw-text-dim/70 shrink-0 text-xs"
                title={`Ranked ${artist.stream_rank} of 500 by lifetime streams`}
              >
                #{artist.stream_rank}
              </span>
            </div>

            <div className="text-sw-text-dim mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Badge
                variant="outline"
                className="border-sw-cyan/40 text-sw-cyan bg-sw-cyan/10 px-2 py-0 font-normal"
              >
                {artist.primary_genre}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <Globe2 className="size-3" aria-hidden="true" />
                {artist.country}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" aria-hidden="true" />
                {artist.artist_type}
              </span>
              <span className="tnum">{artist.debut_year}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p
                className="tnum text-sw-text text-2xl font-semibold"
                title={formatStreamsLong(artist.total_streams_m)}
              >
                {formatStreams(artist.total_streams_m)}
              </p>
              <p className="text-sw-text-dim/80 mt-0.5 text-[0.6875rem] tracking-wide uppercase">
                lifetime streams
              </p>
            </div>
            <ArrowUpRight
              className="text-sw-text-dim group-hover:text-sw-pink size-4 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>

          {/* Solo vs collaborative, as a single stacked bar. The split is the
              most interesting thing the dataset knows about an artist that a
              stream total alone does not say. */}
          <div
            className="mt-3 flex h-1.5 gap-0.5"
            role="img"
            aria-label={`${formatPct(100 - collab)} solo, ${formatPct(collab)} collaborative`}
          >
            <div
              className="rounded-sm bg-[var(--chart-4)]"
              style={{ width: `${100 - collab}%` }}
            />
            <div
              className="rounded-sm bg-[var(--chart-1)]"
              style={{ width: `${collab}%` }}
            />
          </div>
          <p className="text-sw-text-dim/70 tnum mt-1.5 text-[0.6875rem]">
            {formatPct(100 - collab, 0)} solo &middot; {formatPct(collab, 0)}{" "}
            collab
          </p>
        </div>
      </Link>
    </Card>
  );
}
