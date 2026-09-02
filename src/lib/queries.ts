/**
 * Every read of the coursework dataset. Kept in one file so the pages stay
 * about layout and the Supabase query shapes stay reviewable together.
 */
import { supabase } from "@/lib/supabase";
import type {
  Artist,
  CountryStat,
  DecadeStat,
  GenreStat,
} from "@/lib/types";

const ARTIST_COLUMNS =
  "id, slug, name, sex, country, language, primary_genre, artist_type, " +
  "debut_year, total_streams_m, lead_streams_m, feature_streams_m, " +
  "solo_streams_m, solo_pct, collab_streams_m, collab_pct, stream_rank";

export type ArtistFilters = {
  search?: string;
  genre?: string;
  country?: string;
  artistType?: string;
  sort?: "streams" | "name" | "debut" | "collab";
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
    sort = "streams",
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

  switch (sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "debut":
      query = query.order("debut_year", { ascending: false });
      break;
    case "collab":
      query = query.order("collab_pct", { ascending: false });
      break;
    default:
      query = query.order("total_streams_m", { ascending: false });
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
  const { data, error } = await supabase
    .from("artists")
    .select(ARTIST_COLUMNS)
    .eq("primary_genre", artist.primary_genre)
    .neq("id", artist.id)
    .order("total_streams_m", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRelatedArtists failed: ${error.message}`);
  return (data ?? []) as unknown as Artist[];
}

export async function getTopArtists(limit = 10): Promise<Artist[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(ARTIST_COLUMNS)
    .order("total_streams_m", { ascending: false })
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
    countries: countries.map((c) => c.country).sort((a, b) => a.localeCompare(b)),
  };
}

export type ArchiveSummary = {
  artistCount: number;
  countryCount: number;
  genreCount: number;
  totalStreamsM: number;
  earliestDebut: number;
  latestDebut: number;
};

/** The headline numbers in the hero strip. */
export async function getArchiveSummary(): Promise<ArchiveSummary> {
  // min()/max() over debut_year, as two one-row reads rather than pulling all
  // 500 rows back just to look at the ends.
  const yearAt = (ascending: boolean) =>
    supabase
      .from("artists")
      .select("debut_year")
      .not("debut_year", "is", null)
      .order("debut_year", { ascending })
      .limit(1)
      .maybeSingle();

  const [genres, countries, first, last] = await Promise.all([
    getGenreStats(),
    getCountryStats(),
    yearAt(true),
    yearAt(false),
  ]);

  return {
    artistCount: countries.reduce((sum, c) => sum + c.artist_count, 0),
    countryCount: countries.length,
    genreCount: genres.length,
    totalStreamsM: genres.reduce((sum, g) => sum + Number(g.total_streams_m), 0),
    earliestDebut: (first.data as { debut_year: number } | null)?.debut_year ?? 0,
    latestDebut: (last.data as { debut_year: number } | null)?.debut_year ?? 0,
  };
}
