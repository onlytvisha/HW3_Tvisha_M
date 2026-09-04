import { ExternalLink } from "lucide-react";

import { RefreshLiveButton } from "@/components/live/refresh-live-button";
import { TrackPlayer } from "@/components/track-player";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedArtistProfile } from "@/lib/enrich";
import type { Artist } from "@/lib/types";

/**
 * The player and the description - the two slowest things on the page, and the
 * reason it streams. Everything above this in the article is already on screen
 * by the time this resolves.
 */
export async function ArtistFeature({ artist }: { artist: Artist }) {
  const profile = await getCachedArtistProfile(artist);

  return (
    <div className="space-y-6">
      <TrackPlayer artist={artist} profile={profile} />

      {profile.bio && (
        <Card className="sw-card">
          <CardContent className="px-5">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Who they are
            </h2>
            <p className="text-sw-text-dim mt-3 leading-relaxed">
              {profile.bio}
            </p>

            {profile.bio_url && (
              <a
                href={profile.bio_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sw-cyan hover:text-sw-cyan/80 mt-3 inline-flex items-center gap-1.5 text-xs transition-colors"
              >
                Source: {profile.bio_source}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <RefreshLiveButton slug={artist.slug} fetchedAt={profile.fetched_at} />
    </div>
  );
}

export function ArtistFeatureSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="sw-card">
        <CardContent className="px-5">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="mt-4 h-[9.5rem] w-full rounded-xl" />
        </CardContent>
      </Card>

      <Card className="sw-card">
        <CardContent className="space-y-2 px-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
