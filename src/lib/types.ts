/**
 * Row of `public.artists`.
 *
 * Two kinds of row live here, told apart by `source`:
 *
 *   'kaggle'   one of the original 500 from data/spotify_artists.csv. Has
 *              everything, including the frozen lifetime stream figures.
 *   'spotify'  found by the crawl in pipeline/run.py. Has the live figures
 *              and whatever MusicBrainz knew, and NO stream figures - no
 *              streaming service reports a lifetime stream count publicly.
 *
 * So every Kaggle-only column below is nullable, and the UI has to handle a
 * row without them rather than assume a number is there. `hasArchiveStats`
 * in @/lib/artists is the check.
 */
export type Artist = {
  id: number;
  slug: string;
  name: string;
  source: "kaggle" | "spotify";

  sex: string | null;
  country: string | null;
  language: string | null;
  primary_genre: string | null;
  artist_type: string | null;
  debut_year: number | null;

  // --- live ---------------------------------------------------------------
  // Ranking comes from YouTube Music, not Spotify or Deezer. Spotify removed
  // `followers`, `popularity` and `genres` from its artist object for
  // Developer Mode apps in February 2026; what it still gives is an id and a
  // portrait. Deezer, which briefly stood in, is gone too - see
  // supabase/schema-v4-youtube-ranking.sql.
  spotify_id: string | null;
  /** YouTube Music monthly listeners. The archive's ranking axis. */
  monthly_listeners: number | null;
  /**
   * The archive's own 0-100 score: this artist's percentile by monthly
   * listeners within the archive, where 100 is the most-listened-to act
   * here. NOT any provider's own popularity score. Listener counts span
   * five orders of magnitude, so a percentile is what makes a meter
   * readable at every size.
   */
  popularity: number | null;
  /** 1 = most-listened-to in the table. Precomputed by the pipeline. */
  popularity_rank: number | null;
  image_url: string | null;

  /**
   * MusicBrainz's curated genre tags, most-counted first. Distinct from
   * `primary_genre`, which is the archive's own fixed 23-label vocabulary
   * assigned during the Spotify genre-search crawl. Empty if MusicBrainz
   * never matched the artist.
   */
  subgenres: string[];

  /**
   * Up to five of the artist's biggest tracks on YouTube Music, rank 1
   * first, resolved offline by the pipeline.
   */
  top_songs: {
    rank: number;
    video_id: string;
    track_name: string;
    thumbnail: string | null;
  }[];

  // --- frozen, from the Kaggle CSV. Null for a crawled artist. ------------
  total_streams_m: number | null;
  lead_streams_m: number | null;
  feature_streams_m: number | null;
  solo_streams_m: number | null;
  solo_pct: number | null;
  collab_streams_m: number | null;
  collab_pct: number | null;
  stream_rank: number | null;

  synced_at: string | null;
};

/**
 * Row of `public.artist_profiles` - the live layer, fetched from Apple and
 * Wikipedia on first view of an artist and cached thereafter. Every field is
 * nullable: an artist neither source can resolve still gets a (mostly empty)
 * row, so the lookup is not retried on every request.
 */
export type ArtistProfile = {
  artist_id: number;
  image_url: string | null;
  genres: string[];
  genre_source: string | null;
  /**
   * One entry per song in the matching `Artist.top_songs`, same order. Apple's
   * preview URLs never expire, so freshness here is governed purely by
   * `fetched_at`'s 7-day cache TTL. A song with no Apple match is omitted,
   * not null-padded.
   */
  track_previews: {
    video_id: string;
    track_name: string;
    preview_url: string;
    artwork_url: string | null;
  }[];
  bio: string | null;
  bio_source: string | null;
  bio_url: string | null;
  fetched_at: string;
};

/**
 * The aggregate views.
 *
 * `artist_count` counts every artist in the group; `archive_count` counts
 * only those with Kaggle stream figures. The stream columns are aggregates
 * over that second, smaller set, and are null for a group with none - which
 * is why they are nullable here and rendered as "--" rather than 0.
 */
export type GenreStat = {
  genre: string;
  artist_count: number;
  total_listeners: number;
  avg_popularity: number | null;
  peak_popularity: number | null;
  archive_count: number;
  total_streams_m: number | null;
  avg_streams_m: number | null;
  avg_collab_pct: number | null;
};

export type CountryStat = {
  country: string;
  artist_count: number;
  total_listeners: number;
  avg_popularity: number | null;
  archive_count: number;
  total_streams_m: number | null;
  avg_streams_m: number | null;
};

export type DecadeStat = {
  decade: number;
  artist_count: number;
  total_listeners: number;
  avg_popularity: number | null;
  archive_count: number;
  total_streams_m: number | null;
  avg_streams_m: number | null;
};

/** Listener counts bucketed by order of magnitude - see supabase/schema-v4. */
export type ListenerBand = {
  band: number;
  label: string;
  artist_count: number;
};
