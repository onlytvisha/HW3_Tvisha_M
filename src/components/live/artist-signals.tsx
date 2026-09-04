import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedArtistProfile } from "@/lib/enrich";
import type { Artist } from "@/lib/types";

/**
 * The live signals under the artist's name: MusicBrainz's subgenre tags,
 * falling back to Apple's single genre label for an artist MusicBrainz never
 * matched.
 *
 * Not links. MusicBrainz's tag vocabulary is its own, much larger than the
 * archive's 23 canonical labels, and a link here would lead to an empty page
 * for most of them - the linked one is the canonical badge in the masthead.
 *
 * The current listener count used to live here too, back when it came from a
 * request-time provider lookup; it is now resolved offline by the pipeline
 * and lives with the rest of the dataset-derived stat tiles further down the
 * page instead.
 */
export async function ArtistSignals({ artist }: { artist: Artist }) {
  const profile = await getCachedArtistProfile(artist);

  const tags = artist.subgenres.length > 0 ? artist.subgenres : profile.genres;

  if (tags.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {tags.slice(0, 5).map((genre) => (
        <Badge
          key={genre}
          variant="secondary"
          className="bg-sw-surface-2 text-sw-text-dim font-normal"
        >
          {genre}
        </Badge>
      ))}
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
