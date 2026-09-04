-- ============================================================================
-- NEON ARCHIVE - migration 4: Deezer removed, YouTube Music becomes the
-- ranking source AND the track source; MusicBrainz adds subgenres
--
-- Run after schema-v3-deezer-ranking.sql. Safe to re-run.
--
-- Why this migration exists
-- ------------------------
-- Migration 3 moved ranking to Deezer's follower count after Spotify pulled
-- popularity/followers/genres from Developer Mode apps. Deezer is now dropped
-- too, for both jobs it was doing:
--
--   - Ranking. Deezer's nb_fan is replaced by YouTube Music's own
--     "monthly listeners" figure - the same shape of signal, resolved by
--     ytmusicapi (keyless, no quota) in pipeline/youtube_music.py.
--   - Track selection. Deezer used to pick each artist's biggest track, with
--     Apple supplying the actual 30-second preview audio because Deezer's own
--     preview URLs expire in 15 minutes. YouTube Music now picks the track(s)
--     too - up to five, ordered by its own "top releases" shelf - and Apple's
--     permanent preview URLs are looked up per track instead of per artist.
--
-- The archive also gains a real subgenre list, from MusicBrainz's own curated
-- genre vocabulary (a second, cached, artist-lookup request beyond the
-- country/type/sex fields migration 3's era already pulled).
--
-- popularity and popularity_rank keep their names: they were already
-- source-agnostic percentile/rank columns, just computed from followers
-- before. They are now computed from monthly_listeners instead - see
-- pipeline/store.py's assign_popularity_ranks().
-- ============================================================================

-- ------------------------------------------------------- artists: columns --

alter table public.artists
    add column if not exists monthly_listeners bigint,
    add column if not exists subgenres         text[] not null default '{}',
    add column if not exists top_songs         jsonb  not null default '[]';

create index if not exists artists_monthly_listeners_idx
    on public.artists (monthly_listeners desc nulls last);

alter table public.artists drop column if exists deezer_id;
alter table public.artists drop column if exists followers;
alter table public.artists drop column if exists spotify_genres;
alter table public.artists drop column if exists youtube_video_id;
alter table public.artists drop column if exists youtube_track_name;

drop index if exists artists_deezer_id_key;
drop index if exists artists_followers_idx;

-- ------------------------------------------------------ column provenance --

comment on column public.artists.monthly_listeners is
    'YouTube Music monthly listeners, resolved by pipeline/run.py via '
    'ytmusicapi''s get_artist(). Live, refreshed each pipeline run. This is '
    'the archive''s ranking axis - it replaces Deezer''s nb_fan.';

comment on column public.artists.popularity is
    'Archive score, 0-100: the artist''s percentile by monthly_listeners '
    'within the archive, 100 the most-listened-to artist here, 50 the '
    'median. Computed by pipeline/run.py, so it shifts as the archive grows. '
    'Not Spotify''s popularity score and, as of this migration, not derived '
    'from Deezer either.';

comment on column public.artists.popularity_rank is
    '1 = most-listened-to artist in the table, by YouTube Music monthly '
    'listeners, with the listener count itself as the tiebreak. '
    'Precomputed so no page has to rank thousands of rows per request.';

comment on column public.artists.subgenres is
    'MusicBrainz''s curated genre tags for the artist (its inc=genres '
    'lookup), ordered by tag count. Distinct from primary_genre, which is '
    'the archive''s own fixed 23-label vocabulary assigned during the '
    'Spotify genre-search crawl. Empty array if MusicBrainz never matched '
    'the artist.';

comment on column public.artists.top_songs is
    'Up to five of the artist''s biggest tracks on YouTube Music, ordered by '
    'rank (1 = biggest), resolved offline by pipeline/run.py. Each element: '
    '{rank, video_id, track_name, thumbnail}. Replaces youtube_video_id / '
    'youtube_track_name, which held only the single biggest track.';

comment on column public.artists.spotify_id is
    'Spotify artist id. Used only for the portrait image and the album '
    'release dates that give a debut year - Spotify supplies no ranking or '
    'genre data to a Developer Mode app.';

-- ------------------------------------------------------- artist_profiles ---
-- The request-time cache (Apple + Wikipedia, refreshed every 7 days). Its
-- Deezer-shaped provider_* and top_track_* columns are replaced by an array
-- of previews, one per song in artists.top_songs.

alter table public.artist_profiles
    add column if not exists track_previews jsonb not null default '[]';

alter table public.artist_profiles drop column if exists provider;
alter table public.artist_profiles drop column if exists provider_artist_id;
alter table public.artist_profiles drop column if exists provider_url;
alter table public.artist_profiles drop column if exists provider_followers;
alter table public.artist_profiles drop column if exists top_track_name;
alter table public.artist_profiles drop column if exists top_track_album;
alter table public.artist_profiles drop column if exists top_track_image;
alter table public.artist_profiles drop column if exists top_track_preview_url;
alter table public.artist_profiles drop column if exists top_track_url;
alter table public.artist_profiles drop column if exists top_track_rank;

comment on column public.artist_profiles.track_previews is
    'One entry per song in the matching artists.top_songs, in the same '
    'order: {video_id, track_name, preview_url, artwork_url}. preview_url '
    'is Apple''s permanent (non-expiring) 30-second audio file for that '
    'track name - looked up per song, same as image/bio, refreshed every 7 '
    'days. A song with no Apple match is omitted, not null-padded.';

-- ------------------------------------------------------- aggregate views ---
-- Dropped and recreated, not CREATE OR REPLACEd - see migration 2's note:
-- replace cannot rename or reorder existing view columns.

drop view if exists public.genre_stats;
drop view if exists public.country_stats;
drop view if exists public.decade_stats;
drop view if exists public.follower_bands;
drop view if exists public.archive_summary;

create view public.genre_stats with (security_invoker = on) as
    select primary_genre                                as genre,
           count(*)::int                                as artist_count,
           coalesce(sum(monthly_listeners), 0)          as total_listeners,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           max(popularity)                              as peak_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m,
           round(avg(collab_pct), 2)                    as avg_collab_pct
      from public.artists
     where primary_genre is not null
     group by primary_genre
     order by coalesce(sum(monthly_listeners), 0) desc;

create view public.country_stats with (security_invoker = on) as
    select country,
           count(*)::int                                as artist_count,
           coalesce(sum(monthly_listeners), 0)          as total_listeners,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m
      from public.artists
     where country is not null
     group by country
     order by coalesce(sum(monthly_listeners), 0) desc;

create view public.decade_stats with (security_invoker = on) as
    select (debut_year / 10) * 10                       as decade,
           count(*)::int                                as artist_count,
           coalesce(sum(monthly_listeners), 0)          as total_listeners,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m
      from public.artists
     where debut_year is not null
     group by (debut_year / 10) * 10
     order by 1;

-- YouTube Music monthly listeners run one to two orders of magnitude above
-- Deezer fan counts for a comparable artist, so follower_bands' old buckets
-- (topping out at "100M+") would put almost the whole archive in one bin.
-- Renamed and re-bucketed; retune the cutoffs below once real data is loaded
-- if the distribution still looks lopsided.
create view public.listener_bands with (security_invoker = on) as
    with banded as (
        select case
                   when monthly_listeners <       100000 then 0
                   when monthly_listeners <      1000000 then 1
                   when monthly_listeners <     10000000 then 2
                   when monthly_listeners <     50000000 then 3
                   when monthly_listeners <    150000000 then 4
                   else                                     5
               end as band
          from public.artists
         where monthly_listeners is not null
    )
    select band,
           (array['under 100K', '100K - 1M', '1M - 10M',
                  '10M - 50M', '50M - 150M', '150M+'])[band + 1] as label,
           count(*)::int as artist_count
      from banded
     group by band
     order by band;

create view public.archive_summary with (security_invoker = on) as
    select count(*)::int                                as artist_count,
           count(*) filter (where source = 'kaggle')::int as archive_count,
           count(distinct country)                      as country_count,
           count(distinct primary_genre)                as genre_count,
           coalesce(sum(monthly_listeners), 0)           as total_listeners,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           round(sum(total_streams_m), 1)               as total_streams_m,
           min(debut_year)                              as earliest_debut,
           max(debut_year)                              as latest_debut
      from public.artists;

-- ------------------------------------------------------------------- RLS ---
-- Re-opens the temporary write policy so the pipeline can write the new
-- columns on its next run. Run supabase/lock-artists.sql again once it has
-- finished.

drop policy if exists "Seed write artists" on public.artists;
create policy "Seed write artists" on public.artists
    for all using (true) with check (true);
