# Neon Archive

An archive of streaming artists, ranked by how big they are **right now**.
Each artist page pairs a live monthly-listener count with their top 5 tracks
right now — artwork, genre and subgenre tags, a short description, thirty
seconds playable in the page on a spinning pair of vinyl disks, and the whole
song a click away on YouTube Music.

Next.js 16 · shadcn/ui, themed on daisyUI's valentine palette · Supabase
Postgres · a Python data pipeline (Spotipy, ytmusicapi, MusicBrainz) ·
deployed on Vercel.

## What it does

| Page              | What is on it                                                            |
| ----------------- | ------------------------------------------------------------------------ |
| `/`               | Hero stats, the biggest artist right now, the rest of the top 13, genre rail |
| `/artists`        | The whole archive, filterable by genre / country / act type, sortable, paginated |
| `/artists/[slug]` | One artist: the recorder player, top 5 tracks, description, live figures, and their statistics |
| `/genres`         | Every genre, ranked by combined monthly listeners                       |
| `/genres/[slug]`  | The artists filed under one genre, biggest first                        |
| `/charts`         | Listeners by genre and country, how followings are distributed, debuts by decade |
| `/about`          | Every column's provenance, and which figures are live vs. frozen        |

## Two kinds of artist

The archive holds two tiers, and the UI never pretends otherwise.

- **The original 500** come from a Kaggle CSV. They carry lifetime stream
  totals, lead-versus-feature and solo-versus-collaborative splits, country,
  language and debut year.
- **Everyone else** was found by the pipeline crawling Spotify's genre search.
  They carry live figures, a genre, subgenre tags and tracks, and whatever
  MusicBrainz knew about where they are from — and **no stream figures at
  all**, because no streaming service publishes a per-artist lifetime play
  count through a public API.

So every Kaggle column is nullable, and pages render the dataset half only when
it is actually there. A crawled artist gets a "live entry" badge and a card
explaining the gap, rather than a row of zeroes that would read as facts.

## Where the numbers come from

Four public sources and one credentialled one. **The site itself still needs no
API key** — everything requiring a secret happens offline in `pipeline/`.

**YouTube Music** is the ranking, via `ytmusicapi`. Its `get_artist()` call
gives a monthly-listeners figure, which is what the archive sorts on, and its
own "top releases" shelf, already ordered by popularity, which is where an
artist's top 5 tracks come from — one lookup per artist, no key, no quota.
Two quirks worked around in `pipeline/youtube_music.py`:

- A song search answers "Drake" with "Life Is Good (feat. Drake)", credited to
  Future — so only the first credited artist on a track counts as a lead.
- `monthlyListeners`/`subscribers` come back as human-formatted strings
  (`"29.1M"`), and can be entirely absent for an artist YouTube Music tracks
  no figure for — parsed to a number, or left `null` and unranked, never
  coerced to zero.

**iTunes** supplies the **audio**: once YouTube Music has named up to five
tracks, each is looked up on Apple's Search API in parallel for a permanent,
non-expiring 30-second preview file. **YouTube Music decides which tracks,
Apple provides the files** — YouTube Music itself has no keyless embeddable
audio, only a video id.

**Spotify**, via **Spotipy** (the official Python client for the Spotify Web
API), supplies artist portraits and the genre searches that widen the
archive. It is deliberately not the ranking source; see below.

**MusicBrainz** supplies country of origin, act type, and curated subgenre
tags — one extra throttled lookup per artist beyond the country/type search
already run, cached forever once resolved.

**Wikipedia** supplies the description. Picking the right article is the awkward
part — a bare name lands on a colour for *Pink* and a disambiguation page for
*Drake* — so a candidate is accepted only if its title plausibly refers to the
artist **and** its summary reads like it is about music.

Results are written to `artist_profiles` and served from there for seven days,
so a repeat visit costs one Supabase read instead of several outbound calls.

### ⚠ Why Spotify does not rank anything here

This project was built to rank the archive on Spotify's `popularity` score.
**It cannot.** In **February 2026** Spotify removed `followers`, `popularity`
and `genres` from the artist object for every app in Developer Mode, and made
`/artists/{id}/top-tracks` return 403. Verified against this project's own
credentials — `GET /v1/artists/{id}` returns exactly `external_urls, href, id,
images, name, type, uri`. Those fields now require Extended Quota Mode, which
Spotify grants by application and review.

So the ranking moved to YouTube Music's monthly-listeners figure, the same
shape of signal and keyless too. The mirror-image limitation is that YouTube
Music's genre/mood shelves are curated editorial playlists, not a queryable
genre index, so it cannot broaden the archive by genre on its own. **Spotify
proposes artists, YouTube Music scores them.** Neither can do the whole job
alone. Full detail, including the undocumented `limit=10` cap on Spotify
search, is in [`pipeline/README.md`](pipeline/README.md).

### "Archive score" is ours, not any provider's

The 0–100 figure on each artist is **this archive's own**: their percentile by
monthly listeners within the archive, where 100 is the most-listened-to act
here and 50 the median. It exists because raw listener counts span five
orders of magnitude, so a meter drawn from them is a full bar for Drake and
an invisible sliver for everyone else. Being a percentile, it shifts as the
archive grows — which is recorded as a `comment on column` in the migration,
so it is visible from the Supabase table editor too.

## Design

The palette is daisyUI's `valentine` theme — light, rose/lavender/sky-blue —
applied by pointing shadcn/ui's design tokens at it in
`src/app/globals.css` rather than restyling components one by one, so the
stock shadcn components come out themed.

Data marks use a **separate** ramp (`--chart-1` … `--chart-5`), the same five
hues re-stepped for the card's light ground rather than reused directly.

Every chart measures one thing on one axis. Listener counts and the archive
score never share a plot — a 0–100 percentile against an eight-figure count
would need two scales, and a dual-axis chart lets the author imply any
correlation they like by choosing where the axes cross. The score rides along
in the table view instead.

### The player

Each artist page shows a **recorder**: two vinyl disks flanking the
transport, built entirely from CSS gradients on the theme's own colour
variables rather than image assets, so they recolor for free with the theme
switch. The disks spin at a constant speed while a track plays and pick up a
loudness-driven glow — the same technique the sleeve art on the card uses,
described below.

The preview is routed through a Web Audio `AnalyserNode`, so the bars above
the scrub bar are the track's actual frequency bins rather than a loop on a
timer — quiet passages sit low, the drop jumps. That needs the audio element
marked `crossorigin`, which Apple's preview CDN allows; if it ever stops
sending the header the element would fail outright, so a load error drops the
attribute and retries once. The visualiser is worth having, never at the cost
of the audio.

The same read is written to the card as `--np-level` once a frame, which is
what makes the disks and sleeve breathe with the track — a CSS custom property
rather than React state, so nothing re-renders sixty times a second. Space
toggles playback, ignored while a field or another control has focus.
`prefers-reduced-motion` stops the disk spin and the visualiser both.

**Top 5 tracks** are shown as a switchable row beneath the transport; picking
one swaps the `<audio>` element's `src` in place rather than mounting a
second element, since Web Audio only allows one source node per element.

YouTube Music is a **link, not an embed**, and that is a deliberate trade: a
YouTube iframe is cross-origin, so Web Audio cannot read it, and embedding the
player here would have silently cost the visualiser. The link always resolves
to the exact song, since the same YouTube Music lookup supplies both the
video id and the track name — nothing to reconcile between two providers any
more.

### Two themes

**Valentine** is the default. **Paper** — cream ground, ink text — is one
click away in the header, plainer rather than romantic, for reading rather
than being impressed at. Both themes are light; there is no dark mode.

Because every shadcn token in `:root` is declared as `var(--sw-*)`, paper only
restates the raw palette; the whole component layer re-themes for free.

Two things needed real work rather than a token swap:

- **The chart ramp is re-stepped, not reused**, on both themes, so marks stay
  legible against a light card rather than washing out.
- **Monogram tiles are cut with the surface.** They carry black initials, so
  they need a light-enough ground; both themes' accents are darkened for
  text-readability rather than bright, so both cut the tile to a partial tint
  rather than showing the accent at full strength.

The choice is stored in `localStorage` and applied by a small inline script in
`<head>` before first paint — without it, a stored preference only lands at
hydration and every navigation would flash from one palette to the other.

## Running it locally

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com), then open
**SQL Editor → New query** and run these in order:

1. [`supabase/schema.sql`](supabase/schema.sql) — the two tables, the views and RLS
2. [`supabase/schema-v2-spotify.sql`](supabase/schema-v2-spotify.sql) — the live columns, and the views rebuilt around them
3. [`supabase/schema-v3-deezer-ranking.sql`](supabase/schema-v3-deezer-ranking.sql) — Deezer as the ranking source, and the column documentation (historical — superseded by the next migration, kept for the record)
4. [`supabase/schema-v4-youtube-ranking.sql`](supabase/schema-v4-youtube-ranking.sql) — Deezer removed; YouTube Music as the ranking and track source, MusicBrainz subgenres

Fill in from **Project Settings → API Keys**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # publishable / anon key
```

### 3. Load the data

Put the Kaggle CSV at `data/spotify_artists.csv` (it is gitignored — see
[`data/README.md`](data/README.md)), then:

```bash
npm run seed
```

Idempotent: it upserts on `slug`, so re-running is safe.

### 4. Fill in the live half

```bash
python -m pip install -r pipeline/requirements.txt
python pipeline/run.py
```

This adds monthly listeners, portraits, top tracks, subgenres, and — if you
want the archive wider than the original 500 — thousands more artists. It
needs Spotify credentials in `.env.local` for the crawl and the portraits;
without them, run `--skip-crawl --skip-match` and the rest still works. See
[`pipeline/README.md`](pipeline/README.md).

Afterwards run [`supabase/lock-artists.sql`](supabase/lock-artists.sql) to
revoke the temporary write grant the seed and pipeline needed.

### 5. Run

```bash
npm run dev
```

## Deploying

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new),
and add the two `NEXT_PUBLIC_SUPABASE_*` variables under **Settings →
Environment Variables**. `.env.local` is gitignored and is not read by Vercel.

The Spotify credentials are **not** needed on Vercel — nothing in `src/` reads
them. Keep them local to the machine that runs the pipeline.

## Security notes

RLS grants the publishable key `select` on both tables, and `insert`/`update`
on `artist_profiles` only. That last grant is what lets the deployed site run
with no server-side secret at all: the cache is written at request time from the
browser-visible key.

The exposure is bounded and self-healing — every column in that table is
regenerated from the public APIs on the next refresh, none of it is user data,
and the dataset itself stays read-only. Setting `SUPABASE_SERVICE_ROLE_KEY`
makes the app prefer a privileged key instead, at which point those two
policies can be dropped.

## A note on the numbers

Two clocks. Monthly listeners, tracks, artwork, subgenre tags and descriptions
are **live**. Stream totals are **cumulative lifetime counts frozen when the
Kaggle dataset was compiled** — not current figures, not refreshable, and
present for only the original 500 artists. `/about` spells out which is
which, column by column, and the UI keeps the two visually separated
everywhere they appear together.

Coursework project. Not affiliated with Spotify, Apple or YouTube.
