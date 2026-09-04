/**
 * Genre labels <-> URL segments, for /genres and /genres/[slug].
 *
 * The archive's genre labels are display strings with punctuation in them -
 * "Hip-Hop", "R&B", "Children's Music" - so they cannot go in a path as they
 * stand. Slugging is easy; the reverse is not, because "r-b" could have come
 * from several labels and the slug alone cannot say which.
 *
 * So it is resolved against the real list rather than inverted: the page
 * already loads every genre for the index and the rail, and a lookup over 23
 * strings costs nothing. That also means an unknown slug returns undefined
 * and the route can 404, instead of inventing a genre that has no artists.
 */

/** "Hip-Hop" -> "hip-hop", "R&B" -> "r-b", "Children's Music" -> "children-s-music" */
export function genreSlug(genre: string): string {
  return genre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** The label a slug came from, or undefined if no genre produces that slug. */
export function genreFromSlug(
  slug: string,
  genres: string[],
): string | undefined {
  const target = slug.toLowerCase();
  return genres.find((genre) => genreSlug(genre) === target);
}

/** The canonical path for a genre page. */
export function genreHref(genre: string): string {
  return `/genres/${genreSlug(genre)}`;
}
