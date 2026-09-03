/**
 * Apple iTunes Search API - genre tags, and the fallback for everything else.
 *
 * Public, keyless, and rate limited by IP (roughly 20 calls a minute), which
 * is fine because every result is written straight into the artist_profiles
 * cache and reused for a week.
 *
 * Apple files each artist under one clean canonical genre ("R&B/Soul",
 * "Hip-Hop/Rap"), which is what this is used for day to day. It also carries a
 * real 30-second preview file, so it stands in for Deezer whenever Deezer
 * cannot resolve an artist.
 *
 * What it cannot do is rank: no iTunes endpoint exposes a popularity score,
 * and both the lookup and search orderings blend relevance with recency. That
 * is why the biggest-track question goes to Deezer instead - see lib/deezer.ts.
 */
import "server-only";

const SEARCH = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";
const UA = "NeonArchive/1.0 (student coursework project)";

export type ItunesArtist = {
  id: number;
  name: string;
  genre: string | null;
  url: string | null;
};

export type ItunesTrack = {
  name: string;
  album: string;
  artworkUrl: string | null;
  previewUrl: string;
  url: string;
  genre: string | null;
};

export type ItunesResult = {
  artist: ItunesArtist;
  topTrack: ItunesTrack | null;
};

/** Strips accents and invisible format characters before comparing names. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\p{Cf}/gu, "") // impostor entries pad their names with LRM marks
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    // Apple serves this as text/javascript, so res.json() would reject.
    return JSON.parse(await res.text()) as T;
  } catch (err) {
    console.error("iTunes request failed:", url, err);
    return null;
  }
}

type RawResult = {
  wrapperType: string;
  artistId?: number;
  artistName?: string;
  artistLinkUrl?: string;
  trackName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
};

/**
 * Resolve a dataset name to an Apple artist.
 *
 * Apple's relevance order alone is not enough - a search for "The Weeknd"
 * returns "Tyler, The Creator" in the top three - so an exact, accent- and
 * format-character-insensitive name match wins when one exists.
 */
export async function findArtist(name: string): Promise<ItunesArtist | null> {
  const data = await getJson<{ results: RawResult[] }>(
    `${SEARCH}?term=${encodeURIComponent(name)}&entity=musicArtist&limit=8`,
  );

  const results = data?.results ?? [];
  if (results.length === 0) return null;

  const target = normalize(name);
  const best =
    results.find((r) => normalize(r.artistName ?? "") === target) ?? results[0];

  if (!best.artistId) return null;

  return {
    id: best.artistId,
    name: best.artistName ?? name,
    genre: best.primaryGenreName ?? null,
    url: best.artistLinkUrl ?? null,
  };
}

/**
 * A permanent preview URL for one named track.
 *
 * This exists because of a mismatch between the two sources. Deezer decides
 * *which* track is biggest - it is the only one that publishes a rank - but
 * its preview URLs are signed and expire 15 minutes after they are minted,
 * while profiles are cached for a week. Apple's preview URLs carry no
 * signature and no expiry, so once Deezer has named the track, the audio for
 * it is fetched from Apple and survives in the cache as long as the row does.
 *
 * Returns null rather than a near-miss: a wrong song is worse than the
 * caller falling back to Deezer's short-lived URL.
 */
export async function findTrackPreview(
  artistName: string,
  trackName: string,
): Promise<{ previewUrl: string; artworkUrl: string | null } | null> {
  const data = await getJson<{ results: RawResult[] }>(
    `${SEARCH}?term=${encodeURIComponent(`${artistName} ${trackName}`)}` +
      `&entity=song&limit=15`,
  );

  const target = normalize(trackName);
  const artist = normalize(artistName);

  const match = (data?.results ?? []).find((r) => {
    if (!r.previewUrl || !r.trackName) return false;

    // Apple appends parentheticals to titles - "One Dance (feat. Wizkid)" for
    // Deezer's "One Dance" - so an exact match is too strict. The bare title
    // has to be the whole name or its opening, which keeps "One Dance" from
    // matching "One Dance Away" while still allowing the feature credit.
    const candidate = normalize(r.trackName);
    const titleMatches =
      candidate === target || candidate.startsWith(`${target} (`);

    // The search blends in other artists' covers of the same song, so the
    // credited artist has to line up too.
    const artistMatches = normalize(r.artistName ?? "").includes(artist);

    return titleMatches && artistMatches;
  });

  if (!match?.previewUrl) return null;

  return {
    previewUrl: match.previewUrl,
    artworkUrl: match.artworkUrl100?.replace("100x100", "600x600") ?? null,
  };
}

/**
 * The artist, plus their biggest song that actually has a playable preview.
 *
 * Apple returns an artist's songs in popularity order, so we walk the list and
 * take the first entry carrying a previewUrl - a few tracks, usually
 * region-restricted ones, come back without one.
 */
export async function getArtistWithTopTrack(
  name: string,
): Promise<ItunesResult | null> {
  const artist = await findArtist(name);
  if (!artist) return null;

  const data = await getJson<{ results: RawResult[] }>(
    `${LOOKUP}?id=${artist.id}&entity=song&limit=12`,
  );

  // results[0] is the artist record itself; the songs follow.
  const song = (data?.results ?? []).find(
    (r) => r.wrapperType === "track" && r.previewUrl,
  );

  if (!song?.previewUrl) return { artist, topTrack: null };

  return {
    artist,
    topTrack: {
      name: song.trackName ?? "Unknown track",
      album: song.collectionName ?? "",
      // artworkUrl100 is a 100px thumbnail, but Apple serves any size from the
      // same path and 600px is sharp enough for a retina player card.
      artworkUrl: song.artworkUrl100?.replace("100x100", "600x600") ?? null,
      previewUrl: song.previewUrl,
      url: song.trackViewUrl ?? "",
      genre: song.primaryGenreName ?? null,
    },
  };
}
