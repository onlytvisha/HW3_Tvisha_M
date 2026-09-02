-- ============================================================================
-- NEON ARCHIVE - Supabase schema
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Two tables:
--   artists          the static coursework dataset (500 rows, loaded by
--                    "npm run seed" from data/spotify_artists.csv)
--   artist_profiles  a write-through cache of everything the app pulls live
--                    from Deezer, the iTunes Search API and Wikipedia, so a
--                    repeat visit to an artist page costs zero calls
-- ============================================================================

-- ---------------------------------------------------------------- artists --

create table if not exists public.artists (
    id                bigint generated always as identity primary key,
    slug              text        not null unique,
    name              text        not null,
    sex               text,
    country           text,
    language          text,
    primary_genre     text,
    artist_type       text,
    debut_year        smallint,

    -- every stream figure in the source CSV is "in millions"
    total_streams_m   numeric(12, 1) not null,
    lead_streams_m    numeric(12, 1),
    feature_streams_m numeric(12, 1),
    solo_streams_m    numeric(12, 1),
    solo_pct          numeric(6, 3),
    collab_streams_m  numeric(12, 1),
    collab_pct        numeric(6, 3),

    -- 1 = most-streamed artist in the dataset; precomputed at seed time so the
    -- UI never has to rank 500 rows on every request
    stream_rank       integer     not null,

    created_at        timestamptz not null default now()
);

create index if not exists artists_total_streams_idx on public.artists (total_streams_m desc);
create index if not exists artists_genre_idx         on public.artists (primary_genre);
create index if not exists artists_country_idx       on public.artists (country);
create index if not exists artists_debut_year_idx    on public.artists (debut_year);
create index if not exists artists_name_idx          on public.artists (lower(name));

-- -------------------------------------------------------- artist_profiles --
-- Deliberately provider-neutral: the app reads Deezer for the track and Apple
-- for the genre today, and could swap either without a migration.

create table if not exists public.artist_profiles (
    artist_id             bigint primary key
                            references public.artists (id) on delete cascade,

    provider              text,  -- 'Deezer' or 'Apple Music'
    provider_artist_id    text,
    provider_url          text,
    provider_followers    bigint,
    image_url             text,

    genres                text[]      not null default '{}',
    genre_source          text,

    -- the artist's current biggest track. preview_url is a real 30-second
    -- audio file, which is what the inline player streams.
    top_track_name        text,
    top_track_album       text,
    top_track_image       text,
    top_track_preview_url text,
    top_track_url         text,
    -- Deezer's popularity score for the track. The reason Deezer is the
    -- source of truth for "biggest": no iTunes endpoint exposes a rank.
    top_track_rank        integer,

    -- short prose description + where it came from
    bio                   text,
    bio_source            text,
    bio_url               text,

    fetched_at            timestamptz not null default now()
);

create index if not exists artist_profiles_fetched_at_idx
    on public.artist_profiles (fetched_at);

-- ------------------------------------------------------- aggregate views ---
-- The dashboard charts read these instead of pulling 500 rows to the client.
-- security_invoker so they respect the caller's RLS rather than the owner's.

create or replace view public.genre_stats with (security_invoker = on) as
    select primary_genre                     as genre,
           count(*)::int                     as artist_count,
           round(sum(total_streams_m), 1)    as total_streams_m,
           round(avg(total_streams_m), 1)    as avg_streams_m,
           round(avg(collab_pct), 2)         as avg_collab_pct
      from public.artists
     group by primary_genre
     order by sum(total_streams_m) desc;

create or replace view public.country_stats with (security_invoker = on) as
    select country,
           count(*)::int                     as artist_count,
           round(sum(total_streams_m), 1)    as total_streams_m,
           round(avg(total_streams_m), 1)    as avg_streams_m
      from public.artists
     group by country
     order by sum(total_streams_m) desc;

create or replace view public.decade_stats with (security_invoker = on) as
    select (debut_year / 10) * 10             as decade,
           count(*)::int                      as artist_count,
           round(sum(total_streams_m), 1)     as total_streams_m,
           round(avg(total_streams_m), 1)     as avg_streams_m
      from public.artists
     where debut_year is not null
     group by (debut_year / 10) * 10
     order by 1;

-- ------------------------------------------------------------------- RLS ---

alter table public.artists         enable row level security;
alter table public.artist_profiles enable row level security;

-- Everything here is public coursework data, so anyone may read it.
drop policy if exists "Public read artists" on public.artists;
create policy "Public read artists" on public.artists
    for select using (true);

drop policy if exists "Public read artist_profiles" on public.artist_profiles;
create policy "Public read artist_profiles" on public.artist_profiles
    for select using (true);

-- The profile cache is written at request time by the app. Granting the
-- publishable key insert/update on THIS TABLE ONLY is what lets the deployed
-- site run with no server-side secret at all.
--
-- The exposure is bounded and self-healing: every column is regenerated from
-- Apple and Wikipedia on the next refresh, nothing here is user data, and the
-- artists table stays read-only. Set SUPABASE_SERVICE_ROLE_KEY if you would
-- rather these writes went through a privileged key - the app prefers it when
-- present - and then drop the two policies below.
drop policy if exists "Public insert artist_profiles" on public.artist_profiles;
create policy "Public insert artist_profiles" on public.artist_profiles
    for insert with check (true);

drop policy if exists "Public update artist_profiles" on public.artist_profiles;
create policy "Public update artist_profiles" on public.artist_profiles
    for update using (true) with check (true);

-- ---------------------------------------------------------- seeding grant --
-- "npm run seed" needs to write the artists table once. This policy exists so
-- that can happen with the publishable key; REVOKE IT once the 500 rows are
-- loaded, by running supabase/lock-artists.sql.
drop policy if exists "Seed write artists" on public.artists;
create policy "Seed write artists" on public.artists
    for all using (true) with check (true);
