/**
 * Builds the "live" half of an artist page and caches it.
 *
 * The dataset in `public.artists` is a frozen snapshot. Everything an artist
 * page shows as current is assembled here from three keyless sources and
 * written through to `public.artist_profiles`, so the second visitor to a page
 * pays one Supabase read instead of five outbound calls.
 *
 *   Deezer     identity, photo, fan count, and the biggest track - the only
 *              one of the three that publishes a popularity rank
 *   iTunes     the genre tag, and a stand-in track when Deezer draws a blank
 *   Wikipedia  the description, and a portrait when Deezer has none
 */
import "server-only";

import { cache } from "react";

import {
  getArtistWithTopTrack as getDeezer,
  getTrackPreview,
  isPreviewUrlExpired,
  trackIdFromUrl,
} from "@/lib/deezer";
import {
  findArtist as findItunesArtist,
  findTrackPreview,
  getArtistWithTopTrack as getItunes,
} from "@/lib/itunes";
import { getServiceClient, supabase } from "@/lib/supabase";
import type { Artist, ArtistProfile } from "@/lib/types";
import { getArtistSummary } from "@/lib/wikipedia";

/**
 * How long a cached profile stays good. An artist's biggest track moves slowly
 * enough that a week is generous, and it keeps a class demo from tripping the
 * per-IP rate limits on a page refresh.
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

/** Fetches from Deezer, Apple and Wikipedia and assembles a profile row. */
async function buildProfile(artist: Artist): Promise<ArtistProfile> {
  const hint = artist.artist_type === "Group" ? "band" : "musician";

  // Mutually independent, so pay for the slowest rather than the sum.
  const [deezer, apple, wiki] = await Promise.all([
    getDeezer(artist.name),
    findItunesArtist(artist.name),
    getArtistSummary(artist.name, hint),
  ]);

  // Deezer owns the track because it is the only source that can rank. Apple
  // only gets asked for one when Deezer came back with nothing playable.
  const deezerTrack = deezer?.topTrack ?? null;
  const fallback = deezerTrack ? null : await getItunes(artist.name);
  const appleTrack = fallback?.topTrack ?? null;

  const provider = deezerTrack ? "Deezer" : appleTrack ? "Apple Music" : null;

  // Deezer picked the track; Apple is asked for the audio. Deezer's preview
  // URLs are signed and die after 15 minutes, which is nothing against a
  // seven-day cache - a row would spend almost its whole life pointing at a
  // URL that 403s. Apple's carry no expiry, so they survive as long as the
  // row. Deezer's URL stays as the fallback, and is re-minted on read.
  const appleAudio = deezerTrack
    ? await findTrackPreview(artist.name, deezerTrack.title)
    : null;

  return {
    artist_id: artist.id,
    provider,
    provider_artist_id: deezer ? String(deezer.artist.id) : null,
    provider_url: deezer?.artist.url ?? null,
    provider_followers: deezer?.artist.fans ?? null,

    // Deezer's artist portraits are the best of the three; Wikipedia's
    // infobox photo is the next best, and album art is the last resort.
    image_url:
      deezer?.artist.imageUrl ??
      wiki?.thumbnail ??
      deezerTrack?.coverUrl ??
      appleTrack?.artworkUrl ??
      null,

    // Apple files an artist under one clean canonical genre. Deezer's album
    // genres were noisier - a compilation drags in nine unrelated tags.
    genres: apple?.genre ? [apple.genre] : [],
    genre_source: apple?.genre ? "Apple Music" : null,

    top_track_name: deezerTrack?.title ?? appleTrack?.name ?? null,
    top_track_album: deezerTrack?.album ?? appleTrack?.album ?? null,
    top_track_image: deezerTrack?.coverUrl ?? appleTrack?.artworkUrl ?? null,
    top_track_preview_url:
      appleAudio?.previewUrl ??
      deezerTrack?.previewUrl ??
      appleTrack?.previewUrl ??
      null,
    top_track_url: deezerTrack?.url ?? appleTrack?.url ?? null,
    top_track_rank: deezerTrack?.rank ?? null,

    bio: wiki?.extract ?? null,
    bio_source: wiki ? "Wikipedia" : null,
    bio_url: wiki?.url ?? null,

    fetched_at: new Date().toISOString(),
  };
}

/**
 * Re-mints an expired Deezer preview URL in place.
 *
 * Rows written before Apple became the audio source - and the handful where
 * Apple has no match for the track - still point at a signed Deezer URL that
 * only lived 15 minutes. Rather than rebuild the whole profile (five
 * outbound calls, and the bio and fan count have not gone anywhere), this
 * replaces the one field that goes stale, for the price of a single call.
 */
async function refreshPreviewUrl(
  artist: Artist,
  profile: ArtistProfile,
): Promise<ArtistProfile> {
  const url = profile.top_track_preview_url;
  if (!url || !isPreviewUrlExpired(url)) return profile;

  const trackId = profile.top_track_url
    ? trackIdFromUrl(profile.top_track_url)
    : null;

  // Prefer a permanent Apple URL, so this is the last time this row needs it.
  const apple = profile.top_track_name
    ? await findTrackPreview(artist.name, profile.top_track_name)
    : null;

  const fresh =
    apple?.previewUrl ?? (trackId ? await getTrackPreview(trackId) : null);

  if (!fresh) return profile;

  const updated = { ...profile, top_track_preview_url: fresh };
  await writeCache(updated);
  return updated;
}

/**
 * Cache-first profile lookup.
 *
 * `force` skips the freshness check, for the refresh control on the artist
 * page.
 */
export async function getArtistProfile(
  artist: Artist,
  force = false,
): Promise<ArtistProfile> {
  if (!force) {
    const cached = await readCache(artist.id);
    if (cached && isFresh(cached)) return refreshPreviewUrl(artist, cached);
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
