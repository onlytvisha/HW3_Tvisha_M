-- ============================================================================
-- NEON ARCHIVE - migration 3: Deezer becomes the ranking source
--
-- Run after schema-v2-spotify.sql. Safe to re-run.
--
-- Why this migration exists
-- ------------------------
-- Migration 2 was written to rank the archive on Spotify's `popularity` score
-- and `followers` count. In **February 2026** Spotify removed both fields from
-- the artist object for every app in Developer Mode, and made
-- /artists/{id}/top-tracks answer 403. Verified against this project's own
-- credentials: /v1/artists/{id} now returns only
--   external_urls, href, id, images, name, type, uri
-- Those fields are available solely to integrations holding Extended Quota
-- Mode, which is granted by application and not to coursework projects.
--
-- So the ranking moves to Deezer, which publishes an equivalent signal with no
-- key and no restriction: nb_fan, the artist's follower count. Spotify is
-- still used - for artist portraits and for the album dates that give a debut
-- year - but it can no longer say who is big.
--
-- No column is renamed, because two of them still hold exactly what their
-- names say and the third is documented below. What changes is where the
-- values come from, which is what the comments record.
-- ============================================================================

alter table public.artists
    add column if not exists deezer_id text;

create unique index if not exists artists_deezer_id_key
    on public.artists (deezer_id) where deezer_id is not null;

-- ------------------------------------------------------ column provenance --
-- Written into the database rather than only into the README, so the next
-- person to open the table in the Supabase editor can see what these are.

comment on column public.artists.followers is
    'Deezer fan count (nb_fan) - people following the artist on Deezer. Live, '
    'refreshed by pipeline/run.py. This is the archive''s ranking axis. It is '
    'NOT a Spotify follower count: Spotify removed that field from the artist '
    'object for Developer Mode apps in February 2026.';

comment on column public.artists.popularity is
    'Archive score, 0-100. NOT Spotify''s popularity score, which is no longer '
    'available to this app. This is the artist''s percentile by follower count '
    'within the archive: 100 is the most-followed artist here, 50 the median. '
    'Computed by pipeline/run.py, and it therefore shifts as the archive grows.';

comment on column public.artists.popularity_rank is
    '1 = most-followed artist in the table, by Deezer fan count, with the '
    'follower count itself as the tiebreak. Precomputed so no page has to rank '
    'thousands of rows per request.';

comment on column public.artists.spotify_id is
    'Spotify artist id. Used for the portrait and for the album release dates '
    'that give a debut year - Spotify can no longer supply popularity, '
    'followers or genres to a Developer Mode app.';

comment on column public.artists.deezer_id is
    'Deezer artist id, the key the follower count is refreshed against.';

comment on column public.artists.source is
    '''kaggle'' for the original 500 from data/spotify_artists.csv, which carry '
    'the frozen lifetime stream figures; ''spotify'' for everything the crawl '
    'added, which have live figures only.';

comment on column public.artists.total_streams_m is
    'Lifetime streams in millions, frozen at whenever the Kaggle dataset was '
    'compiled. NULL for every crawled artist - no streaming service publishes '
    'a per-artist lifetime play count through a public API.';
