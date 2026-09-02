/**
 * Wikipedia REST + Action API, for the one-paragraph description on each
 * artist page. Public and keyless; Wikimedia only asks for a descriptive
 * User-Agent, which every request here sends.
 *
 * The hard part is not fetching the summary, it is picking the right page.
 * A bare artist name resolves to the wrong article more often than you would
 * expect - "Pink" is a colour, "Drake" and "Queen" are disambiguation pages -
 * so a candidate is only accepted if its title plausibly refers to the artist
 * AND its summary reads like it is about a musician.
 */
import "server-only";

const REST = "https://en.wikipedia.org/api/rest_v1/page/summary";
const ACTION = "https://en.wikipedia.org/w/api.php";
const UA = "NeonArchive/1.0 (student coursework project; Next.js on Vercel)";

export type WikiSummary = {
  title: string;
  extract: string;
  url: string;
  thumbnail: string | null;
};

type RawSummary = {
  type: string;
  title: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
};

const MUSIC_WORDS =
  /\b(singer|rapper|musician|band|songwriter|song|music|group|duo|trio|dj|producer|vocalist|guitarist|record|album|discograph|boy band|girl group|hip[- ]hop|pop|rock|rap)\b/i;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** Does this summary actually describe a musical act? */
function looksMusical(raw: RawSummary): boolean {
  return MUSIC_WORDS.test(`${raw.description ?? ""} ${raw.extract ?? ""}`);
}

/**
 * Does this title refer to the artist we asked about? Accepts the exact name
 * and the usual qualified forms ("Pink (singer)"), and rejects the drift that
 * search introduces - a query for BTS otherwise returns "Jimin".
 */
function titleMatches(title: string, name: string): boolean {
  const t = normalize(title);
  const n = normalize(name);
  return t.includes(n) || n.includes(t);
}

async function fetchSummary(title: string): Promise<RawSummary | null> {
  try {
    const res = await fetch(
      `${REST}/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as RawSummary;
  } catch (err) {
    console.error("Wikipedia summary failed:", title, err);
    return null;
  }
}

async function searchTitles(query: string, limit = 3): Promise<string[]> {
  try {
    const url =
      `${ACTION}?action=query&list=search&format=json&origin=*` +
      `&srsearch=${encodeURIComponent(query)}&srlimit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { search?: { title: string }[] };
    };
    return (json.query?.search ?? []).map((r) => r.title);
  } catch (err) {
    console.error("Wikipedia search failed:", query, err);
    return [];
  }
}

function toSummary(raw: RawSummary): WikiSummary {
  return {
    title: raw.title,
    extract: (raw.extract ?? "").trim(),
    url:
      raw.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(raw.title.replace(/ /g, "_"))}`,
    thumbnail: raw.thumbnail?.source ?? null,
  };
}

/**
 * Best-effort description for an artist.
 *
 * `hint` steers the fallback search - "band" for groups, "musician" for solo
 * acts - and is only used if the direct title lookup misses.
 */
export async function getArtistSummary(
  name: string,
  hint = "musician",
): Promise<WikiSummary | null> {
  // 1. The direct title is right for most artists and costs one request.
  const direct = await fetchSummary(name);
  if (direct && direct.type === "standard" && looksMusical(direct)) {
    return toSummary(direct);
  }

  // 2. Otherwise search, and take the first candidate that is both plausibly
  //    this artist and plausibly about music.
  for (const title of await searchTitles(`${name} ${hint}`)) {
    if (!titleMatches(title, name)) continue;

    const raw = await fetchSummary(title);
    if (raw && raw.type === "standard" && looksMusical(raw)) {
      return toSummary(raw);
    }
  }

  return null;
}
