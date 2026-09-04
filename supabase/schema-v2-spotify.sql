-- ============================================================================
-- NEON ARCHIVE - migration 2: Spotify rankings, a wider archive, YouTube Music
--
-- Run once, after schema.sql, in the Supabase dashboard:
--   SQL Editor -> New query -> paste -> Run.
--
-- Safe to re-run: every statement is idempotent, and nothing here drops a
-- column or deletes a row.
--
-- What changes and why
-- --------------------
-- The archive was 500 rows of frozen Kaggle data ranked by lifetime streams.
-- It is now ranked by Spotify's live popularity score, and the table holds
-- artists Spotify knows about that the CSV never listed.
--
-- That forces two structural changes:
--
--   1. total_streams_m and stream_rank become nullable. They are Kaggle
--      columns, and no Spotify endpoint reports a lifetime stream count, so
--      an artist who arrived through the crawl genuinely has no value for
--      them. Storing a zero would be a lie that every average silently eats.
--
--   2. The aggregate views stop assuming streams exist. They now group on
--      followers and popularity - which every row has - and report the
--      stream columns as a nullable extra, over the subset that has them.
-- ============================================================================

-- ------------------------------------------------------- artists: columns --

alter table public.artists
    -- Spotify's own id, and the natural key for the pipeline's upserts. The
    -- CSV rows get one too, once the pipeline matches them by name.
    add column if not exists spotify_id        text,
    -- 0-100, Spotify's own popularity score. The new ranking axis.
    add column if not exists popularity        smallint,
    add column if not exists followers         bigint,
    -- Spotify's raw genre strings, which are granular and lowercase
    -- ("canadian contemporary r&b"). primary_genre stays the canonical
    -- single label the UI groups on; these are kept for the artist page.
    add column if not exists spotify_genres    text[] not null default '{}',
    -- 1 = most popular artist in the table. Precomputed by the pipeline for
    -- the same reason stream_rank was: so no page has to rank N rows.
    add column if not exists popularity_rank   integer,
    -- 'kaggle' for the original 500, 'spotify' for everything the crawl
    -- added. What the UI reads to decide whether stream stats exist.
    add column if not exists source            text not null default 'kaggle',
    add column if not exists image_url         text,

    -- YouTube Music, resolved offline by the pipeline. Kept on `artists`
    -- rather than in artist_profiles because the profile cache is rebuilt
    -- from the live APIs every seven days and would overwrite them.
    add column if not exists youtube_video_id   text,
    add column if not exists youtube_track_name text,

    add column if not exists synced_at         timestamptz;

-- Postgres will not add a unique constraint with IF NOT EXISTS, so this is
-- the index form, which is idempotent and gives upserts the same guarantee.
create unique index if not exists artists_spotify_id_key
    on public.artists (spotify_id) where spotify_id is not null;

create index if not exists artists_popularity_idx
    on public.artists (popularity desc nulls last);
create index if not exists artists_followers_idx
    on public.artists (followers desc nulls last);
create index if not exists artists_source_idx on public.artists (source);

-- --------------------------------------------- artists: relaxed not-nulls --
-- See note 1 in the header. An artist the crawl found has no Kaggle stream
-- figures, and NULL is the honest way to say so.

alter table public.artists alter column total_streams_m drop not null;
alter table public.artists alter column stream_rank     drop not null;

-- A guard so `source` cannot drift to a value the UI does not handle.
alter table public.artists drop constraint if exists artists_source_check;
alter table public.artists add  constraint artists_source_check
    check (source in ('kaggle', 'spotify'));

-- ------------------------------------------------------- aggregate views ---
-- Rebuilt to lead with followers and popularity, which every row has, and to
-- report the stream columns only over the rows that actually carry them.
--
-- avg(x) already ignores NULLs, so the averages below are over the subset
-- with data; archive_count says how big that subset was, so a reader can see
-- that "avg streams" for a genre is drawn from 9 artists and not 240.
--
-- Dropped and recreated rather than CREATE OR REPLACEd. Replace can only
-- append columns to a view - it cannot reorder or rename the existing ones -
-- and these put total_followers in the slot total_streams_m used to hold, so
-- replace fails with "cannot change name of view column". Dropping is safe:
-- a view stores no data, and nothing in the database depends on these.

drop view if exists public.genre_stats;
drop view if exists public.country_stats;
drop view if exists public.decade_stats;
drop view if exists public.follower_bands;
drop view if exists public.archive_summary;

create view public.genre_stats with (security_invoker = on) as
    select primary_genre                                as genre,
           count(*)::int                                as artist_count,
           coalesce(sum(followers), 0)                  as total_followers,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           max(popularity)                              as peak_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m,
           round(avg(collab_pct), 2)                    as avg_collab_pct
      from public.artists
     where primary_genre is not null
     group by primary_genre
     order by coalesce(sum(followers), 0) desc;

create view public.country_stats with (security_invoker = on) as
    select country,
           count(*)::int                                as artist_count,
           coalesce(sum(followers), 0)                  as total_followers,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m
      from public.artists
     where country is not null
     group by country
     order by coalesce(sum(followers), 0) desc;

create view public.decade_stats with (security_invoker = on) as
    select (debut_year / 10) * 10                       as decade,
           count(*)::int                                as artist_count,
           coalesce(sum(followers), 0)                  as total_followers,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           count(total_streams_m)::int                  as archive_count,
           round(sum(total_streams_m), 1)               as total_streams_m,
           round(avg(total_streams_m), 1)               as avg_streams_m
      from public.artists
     where debut_year is not null
     group by (debut_year / 10) * 10
     order by 1;

-- Follower counts span five orders of magnitude, so a linear histogram is one
-- tall bar and a flat line. These are decade-wide bins, which is the shape the
-- distribution actually has.
create view public.follower_bands with (security_invoker = on) as
    with banded as (
        select case
                   when followers <         10000 then 0
                   when followers <        100000 then 1
                   when followers <       1000000 then 2
                   when followers <      10000000 then 3
                   when followers <     100000000 then 4
                   else                                5
               end as band
          from public.artists
         where followers is not null
    )
    select band,
           (array['under 10K', '10K - 100K', '100K - 1M',
                  '1M - 10M', '10M - 100M', '100M+'])[band + 1] as label,
           count(*)::int as artist_count
      from banded
     group by band
     order by band;

-- --------------------------------------------------------------- summary ---
-- One row, so the hero strip is a single read rather than four aggregates
-- assembled in JavaScript.

create view public.archive_summary with (security_invoker = on) as
    select count(*)::int                                as artist_count,
           count(*) filter (where source = 'kaggle')::int as archive_count,
           count(distinct country)                      as country_count,
           count(distinct primary_genre)                as genre_count,
           coalesce(sum(followers), 0)                   as total_followers,
           round(avg(popularity)::numeric, 1)           as avg_popularity,
           round(sum(total_streams_m), 1)               as total_streams_m,
           min(debut_year)                              as earliest_debut,
           max(debut_year)                              as latest_debut
      from public.artists;

-- ------------------------------------------------------------------- RLS ---
-- The new columns inherit the table's policies, so there is nothing to grant.
-- This only re-opens the temporary write policy the pipeline needs, for the
-- same reason the original seed did. Run supabase/lock-artists.sql when the
-- pipeline has finished.

drop policy if exists "Seed write artists" on public.artists;
create policy "Seed write artists" on public.artists
    for all using (true) with check (true);
