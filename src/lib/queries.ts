/**
 * Every read of the coursework dataset. Kept in one file so the pages stay
 * about layout and the Supabase query shapes stay reviewable together.
 */
import { supabase } from "@/lib/supabase";
import type {
  Artist,
  CountryStat,
  DecadeStat,
  ListenerBand,
  GenreStat,
} from "@/lib/types";

const ARTIST_COLUMNS =
  "id, slug, name, source, sex, country, language, primary_genre, " +
  "artist_type, debut_year, spotify_id, popularity, monthly_listeners, " +
  "subgenres, top_songs, popularity_rank, image_url, " +
  "total_streams_m, lead_streams_m, feature_streams_m, " +
  "solo_streams_m, solo_pct, collab_streams_m, collab_pct, stream_rank, " +
  "synced_at";

export type ArtistSort =
  "popularity" | "listeners" | "streams" | "name" | "debut" | "collab";

export type ArtistFilters = {
  search?: string;
  genre?: string;
  country?: string;
  artistType?: string;
  /** Only artists with the frozen Kaggle stream figures. */
  archiveOnly?: boolean;
  sort?: ArtistSort;
  limit?: number;
  offset?: number;
};

export async function getArtists(
  filters: ArtistFilters = {},
): Promise<{ artists: Artist[]; total: number }> {
  const {
    search,
    genre,
    country,
    artistType,
    archiveOnly,
    sort = "popularity",
    limit = 24,
    offset = 0,
  } = filters;

  let query = supabase
    .from("artists")
    .select(ARTIST_COLUMNS, { count: "exact" });

  if (search) query = query.ilike("name", `%${search}%`);
  if (genre) query = query.eq("primary_genre", genre);
  if (country) query = query.eq("country", country);
  if (artistType) query = query.eq("artist_type", artistType);
  if (archiveOnly) query = query.eq("source", "kaggle");

  // Every sort puts nulls last. Most of these columns are now nullable - a
  // crawled artist has no stream figures, and an artist Spotify could not
  // match has no popularity - and Postgres sorts NULLs first on a descending
  // order, which would open the archive with a page of blank cards.
  switch (sort) {
    case "listeners":
      query = query.order("monthly_listeners", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "streams":
      query = query.order("total_streams_m", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "debut":
      query = query.order("debut_year", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "collab":
      query = query.order("collab_pct", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    default:
      // popularity_rank rather than popularity: the score is an integer 0-100,
      // so a 2,000-row archive has ~20 artists on every value and the order
      // inside a score would otherwise be whatever Postgres returned that
      // request. The rank column is precomputed with a listener-count tiebreak, so
      // paging through the archive is stable.
      query = query.order("popularity_rank", {
        ascending: true,
        nullsFirst: false,
      });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`getArtists failed: ${error.message}`);

  return { artists: (data ?? []) as unknown as Artist[], total: count ?? 0 };
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from("artists")
    .select(ARTIST_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getArtistBySlug failed: ${error.message}`);
  return (data as unknown as Artist | null) ?? null;
}

/** Other artists filed under the same genre, for the "see also" rail. */
export async function getRelatedArtists(
  artist: Artist,
  limit = 4,
): Promise<Artist[]> {
  if (!artist.primary_genre) return [];

  const { data, error } = await supabase
    .from("artists")
    .select(ARTIST_COLUMNS)
    .eq("primary_genre", artist.primary_genre)
    .neq("id", artist.id)
    .order("popularity_rank", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`getRelatedArtists failed: ${error.message}`);
  return (data ?? []) as unknown as Artist[];
}

/** The most popular artists right now - the homepage rail. */
export async function getTopArtists(limit = 10): Promise<Artist[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(ARTIST_COLUMNS)
    .order("popularity_rank", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`getTopArtists failed: ${error.message}`);
  return (data ?? []) as unknown as Artist[];
}

export async function getGenreStats(): Promise<GenreStat[]> {
  const { data, error } = await supabase.from("genre_stats").select("*");
  if (error) throw new Error(`getGenreStats failed: ${error.message}`);
  return (data ?? []) as GenreStat[];
}

export async function getCountryStats(): Promise<CountryStat[]> {
  const { data, error } = await supabase.from("country_stats").select("*");
  if (error) throw new Error(`getCountryStats failed: ${error.message}`);
  return (data ?? []) as CountryStat[];
}

export async function getDecadeStats(): Promise<DecadeStat[]> {
  const { data, error } = await supabase.from("decade_stats").select("*");
  if (error) throw new Error(`getDecadeStats failed: ${error.message}`);
  return (data ?? []) as DecadeStat[];
}

/** Listener counts bucketed by order of magnitude, for the distribution chart. */
export async function getListenerBands(): Promise<ListenerBand[]> {
  const { data, error } = await supabase
    .from("listener_bands")
    .select("*")
    .order("band");

  if (error) throw new Error(`getListenerBands failed: ${error.message}`);
  return (data ?? []) as ListenerBand[];
}

/** One genre's aggregate row, for the genre page header. */
export async function getGenreStat(genre: string): Promise<GenreStat | null> {
  const { data, error } = await supabase
    .from("genre_stats")
    .select("*")
    .eq("genre", genre)
    .maybeSingle();

  if (error) throw new Error(`getGenreStat failed: ${error.message}`);
  return (data as GenreStat | null) ?? null;
}

/** Distinct values for the archive filter dropdowns. */
export async function getFilterOptions(): Promise<{
  genres: string[];
  countries: string[];
}> {
  const [genres, countries] = await Promise.all([
    getGenreStats(),
    getCountryStats(),
  ]);

  return {
    genres: genres.map((g) => g.genre).sort((a, b) => a.localeCompare(b)),
    countries: countries
      .map((c) => c.country)
      .sort((a, b) => a.localeCompare(b)),
  };
}

export type ArchiveSummary = {
  /** Every artist in the table. */
  artistCount: number;
  /** How many of those are the original Kaggle 500, with stream figures. */
  archiveCount: number;
  countryCount: number;
  genreCount: number;
  totalListeners: number;
  avgPopularity: number | null;
  totalStreamsM: number | null;
  earliestDebut: number | null;
  latestDebut: number | null;
};

/**
 * The headline numbers in the hero strip.
 *
 * One read of the `archive_summary` view. This used to be four queries
 * assembled in JavaScript, including two one-row reads to find the ends of
 * the debut range; Postgres does all of it in the view now, which matters
 * more at 2,000 rows than it did at 500.
 */
export async function getArchiveSummary(): Promise<ArchiveSummary> {
  const { data, error } = await supabase
    .from("archive_summary")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`getArchiveSummary failed: ${error.message}`);

  const row = (data ?? {}) as Record<string, number | null>;
  return {
    artistCount: Number(row.artist_count ?? 0),
    archiveCount: Number(row.archive_count ?? 0),
    countryCount: Number(row.country_count ?? 0),
    genreCount: Number(row.genre_count ?? 0),
    totalListeners: Number(row.total_listeners ?? 0),
    avgPopularity:
      row.avg_popularity == null ? null : Number(row.avg_popularity),
    totalStreamsM:
      row.total_streams_m == null ? null : Number(row.total_streams_m),
    earliestDebut:
      row.earliest_debut == null ? null : Number(row.earliest_debut),
    latestDebut: row.latest_debut == null ? null : Number(row.latest_debut),
  };
}
