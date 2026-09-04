/**
 * Small predicates about an artist row, so the two-tier archive is read the
 * same way everywhere.
 *
 * The table holds artists from two places (see the `Artist` type), and most
 * of the UI has to branch on which. Doing that with an inline
 * `artist.source === "kaggle"` in a dozen components invites the wrong test:
 * what a stat tile actually needs to know is "is there a stream figure to
 * render", and that is a question about the column, not about provenance.
 */
import type { Artist } from "@/lib/types";

/**
 * Whether this artist carries the frozen Kaggle figures - lifetime streams,
 * the solo/collaborative split, the lead/feature split.
 *
 * Tested on the column rather than on `source`, because that is the thing the
 * caller is about to render. They agree today, and if a later pipeline ever
 * backfills stream data onto a crawled artist they will not.
 */
export function hasArchiveStats(artist: Artist): boolean {
  return artist.total_streams_m != null;
}

/** Whether YouTube Music could be matched to this artist at all. */
export function hasLiveRanking(artist: Artist): boolean {
  return artist.popularity != null && artist.popularity_rank != null;
}

/**
 * The genre tags to show on an artist page, most representative first.
 *
 * MusicBrainz's subgenre tags where it has them, since they are the finer of
 * the two, with the archive's single canonical label appended when it is not
 * already implied. Capped, because some artists carry a dozen tags and a row
 * of a dozen badges is a wall.
 */
export function displayGenres(artist: Artist, max = 4): string[] {
  const tags = [...(artist.subgenres ?? [])];

  if (artist.primary_genre) {
    const already = tags.some(
      (tag) => tag.toLowerCase() === artist.primary_genre!.toLowerCase(),
    );
    if (!already) tags.unshift(artist.primary_genre);
  }

  return tags.slice(0, max);
}
