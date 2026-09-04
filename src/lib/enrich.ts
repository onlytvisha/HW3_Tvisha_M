/**
 * Builds the "live" half of an artist page and caches it.
 *
 * The dataset in `public.artists` is a frozen snapshot, except for
 * `monthly_listeners`, `top_songs` and `subgenres`, which the pipeline
 * already resolved offline (see pipeline/run.py) and stored directly on the
 * row - no live call needed for any of those at request time. What this file
 * assembles and writes through to `public.artist_profiles` is everything
 * that still has to be fetched live:
 *
 *   iTunes     the genre tag, and a permanent 30-second preview file for
 *              each of the artist's `top_songs`
 *   Wikipedia  the description, and a portrait when no other source has one
 */
import "server-only";

import { cache } from "react";

import { findArtist as findItunesArtist, findTrackPreview } from "@/lib/itunes";
import { getServiceClient, supabase } from "@/lib/supabase";
import type { Artist, ArtistProfile } from "@/lib/types";
import { getArtistSummary } from "@/lib/wikipedia";

/**
 * How long a cached profile stays good. An artist's biggest tracks move
 * slowly enough that a week is generous, and it keeps a class demo from
 * tripping the per-IP rate limits on a page refresh. Apple's preview URLs
 * never expire, so unlike the old Deezer-backed profile, nothing here goes
 * stale mid-TTL - a cache hit is simply served as-is until it ages out.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isFresh(profile: ArtistProfile): boolean {
  return Date.now() - new Date(profile.fetched_at).getTime() < TTL_MS;
}

async function readCache(artistId: number): Promise<ArtistProfile | null> {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("artist_id", artistId)
    .maybeSingle();

  if (error) {
    console.error("artist_profiles read failed:", error.message);
    return null;
  }
  return (data as ArtistProfile | null) ?? null;
}

async function writeCache(profile: ArtistProfile): Promise<void> {
  // The service client when a key is configured, otherwise the anon client -
  // RLS grants it insert/update on this table precisely so the cache works
  // without a server secret. See supabase/schema.sql.
  const client = getServiceClient() ?? supabase;

  const { error } = await client
    .from("artist_profiles")
    .upsert(profile, { onConflict: "artist_id" });

  if (error) console.error("artist_profiles write failed:", error.message);
}

/** Fetches from Apple and Wikipedia and assembles a profile row. */
async function buildProfile(artist: Artist): Promise<ArtistProfile> {
  const hint = artist.artist_type === "Group" ? "band" : "musician";
  const songs = artist.top_songs ?? [];

  // Mutually independent, so pay for the slowest rather than the sum. One
  // iTunes preview lookup per song, in parallel - up to five, well inside
  // the ~20/minute keyless rate limit, and cached for a week same as the
  // rest of the profile.
  const [apple, wiki, previewLookups] = await Promise.all([
    findItunesArtist(artist.name),
    getArtistSummary(artist.name, hint),
    Promise.all(songs.map((s) => findTrackPreview(artist.name, s.track_name))),
  ]);

  const track_previews = songs
    .map((song, i) => {
      const found = previewLookups[i];
      if (!found) return null;
      return {
        video_id: song.video_id,
        track_name: song.track_name,
        preview_url: found.previewUrl,
        artwork_url: found.artworkUrl,
      };
    })
    .filter(
      (preview): preview is NonNullable<typeof preview> => preview !== null,
    );

  return {
    artist_id: artist.id,

    // Wikipedia's infobox photo, then the biggest song's own thumbnail.
    image_url: wiki?.thumbnail ?? songs[0]?.thumbnail ?? null,

    // Apple files an artist under one clean canonical genre.
    genres: apple?.genre ? [apple.genre] : [],
    genre_source: apple?.genre ? "Apple Music" : null,

    track_previews,

    bio: wiki?.extract ?? null,
    bio_source: wiki ? "Wikipedia" : null,
    bio_url: wiki?.url ?? null,

    fetched_at: new Date().toISOString(),
  };
}

/** Cache-first profile lookup. `force` skips the freshness check. */
export async function getArtistProfile(
  artist: Artist,
  force = false,
): Promise<ArtistProfile> {
  if (!force) {
    const cached = await readCache(artist.id);
    if (cached && isFresh(cached)) return cached;
  }

  const profile = await buildProfile(artist);
  await writeCache(profile);
  return profile;
}

/**
 * Request-scoped memo of the above.
 *
 * The artist page streams the portrait, the tags and the player in as three
 * separate Suspense boundaries, and each needs the same profile. React's
 * `cache` collapses those into one lookup per request, so a cold artist costs
 * one round of outbound calls rather than three.
 */
export const getCachedArtistProfile = cache(
  (artist: Artist): Promise<ArtistProfile> => getArtistProfile(artist),
);
