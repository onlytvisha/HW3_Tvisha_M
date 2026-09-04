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
      // Wikipedia's infobox photo when the live lookup found one, then the
      // artist's biggest track's own thumbnail, then the Spotify portrait the
      // pipeline stored on the row. The last is why most artists have a face
      // at all: Wikipedia only has an infobox photo for acts notable enough
      // to have won one, and the crawl added many that are not.
      imageUrl={profile.image_url ?? artist.image_url}
      className={`${FRAME} ring-sw-line/60 ring-1`}
    />
  );
}

/** Same footprint as the real thing, so the header never reflows. */
export function ArtistPortraitSkeleton() {
  return <Skeleton className={FRAME} />;
}
