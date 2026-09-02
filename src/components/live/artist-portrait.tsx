import { ArtistAvatar } from "@/components/artist-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedArtistProfile } from "@/lib/enrich";
import type { Artist } from "@/lib/types";

const FRAME = "size-32 rounded-2xl text-4xl sm:size-40 sm:text-5xl";

/**
 * The artist's photo, streamed in behind its own Suspense boundary so the rest
 * of the masthead - name, badges, dataset facts - paints immediately.
 */
export async function ArtistPortrait({ artist }: { artist: Artist }) {
  const profile = await getCachedArtistProfile(artist);

  return (
    <ArtistAvatar
      name={artist.name}
      imageUrl={profile.image_url}
      className={`${FRAME} ring-sw-line/60 ring-1`}
    />
  );
}

/** Same footprint as the real thing, so the header never reflows. */
export function ArtistPortraitSkeleton() {
  return <Skeleton className={FRAME} />;
}
