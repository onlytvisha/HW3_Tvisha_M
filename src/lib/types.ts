/** Row of `public.artists` - the coursework dataset, loaded once by npm run seed. */
export type Artist = {
  id: number;
  slug: string;
  name: string;
  sex: string | null;
  country: string | null;
  language: string | null;
  primary_genre: string | null;
  artist_type: string | null;
  debut_year: number | null;
  total_streams_m: number;
  lead_streams_m: number | null;
  feature_streams_m: number | null;
  solo_streams_m: number | null;
  solo_pct: number | null;
  collab_streams_m: number | null;
  collab_pct: number | null;
  stream_rank: number;
};

/**
 * Row of `public.artist_profiles` - the live layer, fetched from Deezer,
 * Apple and Wikipedia on first view of an artist and cached thereafter.
 * Every field is nullable: an artist neither source can resolve still gets a
 * (mostly empty) row, so the lookup is not retried on every request.
 */
export type ArtistProfile = {
  artist_id: number;
  provider: string | null;
  provider_artist_id: string | null;
  provider_url: string | null;
  provider_followers: number | null;
  image_url: string | null;
  genres: string[];
  genre_source: string | null;
  top_track_name: string | null;
  top_track_album: string | null;
  top_track_image: string | null;
  top_track_preview_url: string | null;
  top_track_url: string | null;
  /** Deezer's own popularity score for the track, when Deezer supplied it. */
  top_track_rank: number | null;
  bio: string | null;
  bio_source: string | null;
  bio_url: string | null;
  fetched_at: string;
};

export type GenreStat = {
  genre: string;
  artist_count: number;
  total_streams_m: number;
  avg_streams_m: number;
  avg_collab_pct: number;
};

export type CountryStat = {
  country: string;
  artist_count: number;
  total_streams_m: number;
  avg_streams_m: number;
};

export type DecadeStat = {
  decade: number;
  artist_count: number;
  total_streams_m: number;
  avg_streams_m: number;
};
