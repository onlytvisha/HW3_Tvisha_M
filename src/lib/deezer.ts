/**
 * Deezer API - where "their biggest track" actually comes from.
 *
 * Public and keyless, like Apple's, but with the one thing Apple does not
 * expose: a per-track `rank`, Deezer's own popularity score. Without it there
 * is no honest way to answer "what is this artist's most-streamed song" - the
 * iTunes endpoints are ordered by relevance and recency, which is how you end
 * up offering a Future song as Drake's biggest.
 *
 * Two quirks this module exists to paper over:
 *   1. Artist search returns impostors. A search for Rihanna surfaces a
 *      752-fan account before the real one.
 *   2. `/artist/{id}/top` is NOT sorted by rank, despite the name, and mixes
 *      in tracks where the artist is only a guest.
 */
import "server-only";

const API = "https://api.deezer.com";

export type DeezerArtist = {
  id: number;
  name: string;
  fans: number;
  imageUrl: string | null;
  url: string | null;
};

export type DeezerTrack = {
  title: string;
  album: string;
  coverUrl: string | null;
  previewUrl: string | null;
  url: string | null;
  rank: number;
};

export type DeezerResult = {
  artist: DeezerArtist;
  topTrack: DeezerTrack | null;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { "User-Agent": "NeonArchive/1.0 (student coursework project)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as T & { error?: unknown };
    // Deezer answers 200 with an { error: ... } body for quota and bad ids.
    if (json && typeof json === "object" && "error" in json && json.error) {
      console.error("Deezer returned an error for", path, json.error);
      return null;
    }
    return json;
  } catch (err) {
    console.error("Deezer request failed:", path, err);
    return null;
  }
}

type RawArtist = {
  id: number;
  name: string;
  nb_fan?: number;
  picture_xl?: string;
  picture_big?: string;
  link?: string;
};

/**
 * Resolve a dataset name to a Deezer artist.
 *
 * Prefers an exact, accent-insensitive name match, then takes whichever
 * candidate has the most fans - which is what separates the real Rihanna
 * (18M fans) from the impostor that search ranks first (752).
 */
async function findArtist(name: string): Promise<DeezerArtist | null> {
  const data = await getJson<{ data: RawArtist[] }>(
    `/search/artist?q=${encodeURIComponent(name)}&limit=10`,
  );

  const items = data?.data ?? [];
  if (items.length === 0) return null;

  const target = normalize(name);
  const exact = items.filter((a) => normalize(a.name) === target);
  const pool = exact.length > 0 ? exact : items;

  const best = pool.reduce((a, b) => ((b.nb_fan ?? 0) > (a.nb_fan ?? 0) ? b : a));

  return {
    id: best.id,
    name: best.name,
    fans: best.nb_fan ?? 0,
    imageUrl: best.picture_xl ?? best.picture_big ?? null,
    url: best.link ?? null,
  };
}

type RawTrack = {
  title: string;
  rank?: number;
  preview?: string;
  link?: string;
  artist?: { id: number };
  album?: { title?: string; cover_xl?: string; cover_big?: string };
};

/**
 * The artist's biggest track.
 *
 * Lead tracks win over features, because a listener asking for Drake's biggest
 * song does not mean the Future record he guests on. Among those, highest
 * `rank` wins - the endpoint's own order cannot be trusted.
 */
export async function getArtistWithTopTrack(
  name: string,
): Promise<DeezerResult | null> {
  const artist = await findArtist(name);
  if (!artist) return null;

  const data = await getJson<{ data: RawTrack[] }>(
    `/artist/${artist.id}/top?limit=25`,
  );

  const playable = (data?.data ?? []).filter((t) => t.preview);
  const lead = playable.filter((t) => t.artist?.id === artist.id);
  const pool = lead.length > 0 ? lead : playable;

  const best = pool.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
  if (!best) return { artist, topTrack: null };

  return {
    artist,
    topTrack: {
      title: best.title,
      album: best.album?.title ?? "",
      coverUrl: best.album?.cover_xl ?? best.album?.cover_big ?? null,
      previewUrl: best.preview ?? null,
      url: best.link ?? null,
      rank: best.rank ?? 0,
    },
  };
}
