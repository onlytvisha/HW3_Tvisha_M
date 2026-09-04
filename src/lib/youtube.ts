/**
 * Links out to YouTube Music.
 *
 * YouTube Music is the one place a visitor can hear the whole song rather
 * than a 30-second clip, without an account and without a paywall - which is
 * the reason it is on the page at all, and also why it now supplies the
 * track itself rather than just linking to a track someone else picked.
 *
 * Two link shapes, in order of preference:
 *
 *   watch    an exact video id, resolved offline by pipeline/run.py through
 *            ytmusicapi. One click, straight into the song.
 *   search   a query built from the artist and track name. Needs nothing
 *            resolved and no key, so it always works - it just costs the
 *            listener one extra tap.
 *
 * There is no title-matching guard here any more. That existed to reconcile
 * two different providers' naming - a video id from YouTube Music's last
 * pipeline run against a track name Deezer had chosen independently, which
 * could drift apart between refreshes. Now that YouTube Music supplies both
 * the video id and the track name for the same resolution, they cannot
 * disagree with each other - the search fallback is only for an artist the
 * pipeline has not resolved a track for at all.
 */

/** A direct link to one track on YouTube Music. */
export function watchUrl(videoId: string): string {
  return `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/** A YouTube Music search for a track, for when there is no resolved id. */
export function searchUrl(artist: string, track?: string | null): string {
  const query = track ? `${artist} ${track}` : artist;
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Where the "Listen on YouTube Music" button should point, and whether it
 * lands on the exact song.
 */
export function youtubeMusicLink({
  artistName,
  trackName,
  videoId,
}: {
  artistName: string;
  trackName?: string | null;
  videoId?: string | null;
}): { href: string; exact: boolean } {
  if (videoId) {
    return { href: watchUrl(videoId), exact: true };
  }
  return { href: searchUrl(artistName, trackName), exact: false };
}
