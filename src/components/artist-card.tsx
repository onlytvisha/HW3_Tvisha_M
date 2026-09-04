import { ArrowUpRight, Globe2, Users } from "lucide-react";
import Link from "next/link";

import { ArtistAvatar } from "@/components/artist-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { hasArchiveStats } from "@/lib/artists";
import { formatCount, formatPct, formatStreams } from "@/lib/format";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One entry in the archive feed.
 *
 * Leads with the two figures every artist has - YouTube Music monthly
 * listeners and the archive score derived from them - because the archive
 * now holds artists the Kaggle CSV never listed, and those have no lifetime
 * stream total, no solo/collab split and no debut year. The dataset half of
 * the card is rendered only when it is actually there, rather than as a row
 * of zeroes.
 */
export function ArtistCard({
  artist,
  className,
}: {
  artist: Artist;
  className?: string;
}) {
  const archived = hasArchiveStats(artist);
  const collab = Number(artist.collab_pct ?? 0);
  const popularity = artist.popularity ?? 0;

  return (
    <Card
      className={cn(
        "sw-card group relative gap-0 overflow-hidden p-0",
        className,
      )}
    >
      <Link
        href={`/artists/${artist.slug}`}
        className="focus-visible:ring-ring/60 flex h-full flex-col focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-start gap-4 p-5">
          <ArtistAvatar
            name={artist.name}
            imageUrl={artist.image_url}
            className="size-14 shrink-0 rounded-lg text-lg"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="group-hover:text-sw-pink truncate text-lg leading-tight font-semibold transition-colors">
                {artist.name}
              </h3>
              {artist.popularity_rank != null && (
                <span
                  className="tnum text-sw-text-dim/70 shrink-0 text-xs"
                  title={`Ranked ${artist.popularity_rank} in the archive by YouTube Music monthly listeners right now`}
                >
                  #{artist.popularity_rank}
                </span>
              )}
            </div>

            <div className="text-sw-text-dim mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {artist.primary_genre && (
                <Badge
                  variant="outline"
                  className="border-sw-cyan/40 text-sw-cyan bg-sw-cyan/10 px-2 py-0 font-normal"
                >
                  {artist.primary_genre}
                </Badge>
              )}
              {artist.country && (
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="size-3" aria-hidden="true" />
                  {artist.country}
                </span>
              )}
              {artist.artist_type && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden="true" />
                  {artist.artist_type}
                </span>
              )}
              {artist.debut_year != null && (
                <span className="tnum">{artist.debut_year}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="tnum text-sw-text text-2xl font-semibold">
                {formatCount(artist.monthly_listeners)}
              </p>
              <p className="text-sw-text-dim/80 mt-0.5 text-[0.6875rem] tracking-wide uppercase">
                YouTube Music listeners
              </p>
            </div>
            <ArrowUpRight
              className="text-sw-text-dim group-hover:text-sw-pink size-4 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>

          {/* The archive score, as a meter. It is a percentile of monthly
              listeners within the archive, so the bar is the honest picture:
              listener counts span five orders of magnitude, and a bar drawn
              from the raw number is full for Drake and invisible for
              everyone else. */}
          {artist.popularity != null && (
            <div className="mt-3">
              <div
                className="bg-sw-surface-2 h-1.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`Archive score ${popularity} out of 100`}
              >
                <div
                  className="h-full rounded-full bg-[var(--chart-2)]"
                  style={{ width: `${popularity}%` }}
                />
              </div>
              <p className="text-sw-text-dim/70 tnum mt-1.5 text-[0.6875rem]">
                archive score {popularity}/100
              </p>
            </div>
          )}

          {/* The dataset half. Only the original 500 have it, so it is
              rendered when present rather than zeroed - a 0% / 0% split
              would read as a fact about the artist rather than a gap. */}
          {archived && (
            <div className="border-sw-line/50 mt-3 border-t pt-3">
              <div
                className="flex h-1.5 gap-0.5"
                role="img"
                aria-label={`${formatPct(100 - collab)} solo, ${formatPct(collab)} collaborative`}
              >
                <div
                  className="rounded-sm bg-[var(--chart-4)]"
                  style={{ width: `${100 - collab}%` }}
                />
                {/* chart-5 rather than chart-1: this bar is 6px tall with no
                    label on either segment, so colour is the only thing
                    telling the two apart, and 4-against-1 is the pair in the
                    ramp that deuteranopia flattens (dE 5.6). 4-5 is dE 21.3. */}
                <div
                  className="rounded-sm bg-[var(--chart-5)]"
                  style={{ width: `${collab}%` }}
                />
              </div>
              <p className="text-sw-text-dim/70 tnum mt-1.5 text-[0.6875rem]">
                {formatStreams(artist.total_streams_m)} lifetime &middot;{" "}
                {formatPct(100 - collab, 0)} solo
              </p>
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}
