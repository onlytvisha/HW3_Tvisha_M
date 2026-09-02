import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedArtistProfile } from "@/lib/enrich";
import { formatCount } from "@/lib/format";
import type { Artist } from "@/lib/types";

/**
 * The live signals under the artist's name: a current fan count, the genre
 * Apple files them under, and a link out.
 *
 * Kept visually distinct from the dataset figures further down the page, since
 * these are current and those are a fixed snapshot.
 */
export async function ArtistSignals({ artist }: { artist: Artist }) {
  const profile = await getCachedArtistProfile(artist);

  const hasAnything =
    profile.provider_followers != null ||
    profile.genres.length > 0 ||
    profile.provider_url;

  if (!hasAnything) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {profile.provider_followers != null && profile.provider_followers > 0 && (
        <span className="text-sw-text-dim">
          <span className="tnum text-sw-text font-medium">
            {formatCount(profile.provider_followers)}
          </span>{" "}
          Deezer fans
        </span>
      )}

      {profile.genres.map((genre) => (
        <Badge
          key={genre}
          variant="secondary"
          className="bg-sw-surface-2 text-sw-text-dim font-normal"
        >
          {genre}
        </Badge>
      ))}

      {profile.provider_url && (
        <a
          href={profile.provider_url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sw-cyan hover:text-sw-cyan/80 inline-flex items-center gap-1.5 transition-colors"
        >
          Open on {profile.provider}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export function ArtistSignalsSkeleton() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
