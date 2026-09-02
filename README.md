# Neon Archive

A synthwave archive of 500 streaming artists. Each artist page pairs their
historical stream statistics from a Kaggle dataset with their **current
biggest track**, photo, genre tags and a short description pulled live from
Spotify and Wikipedia — and plays the track in the page.

Next.js 16 · shadcn/ui · Supabase Postgres · deployed on Vercel.

## What it does

| Page             | What is on it                                                                       |
| ---------------- | ----------------------------------------------------------------------------------- |
| `/`              | Hero stats, the #1 artist, the rest of the top 13, genre rail                        |
| `/artists`       | All 500, filterable by genre / country / act type, sortable, paginated               |
| `/artists/[slug]`| One artist: live player, description, genre tags, and their dataset statistics       |
| `/charts`        | Streams by genre and country, debuts by decade — each with a table view              |
| `/about`         | Every column's provenance, and which figures are live vs. frozen                     |

## Design

The palette is daisyUI's `synthwave` theme, applied by pointing shadcn/ui's
design tokens at it in `src/app/globals.css` rather than restyling components
one by one — so the stock shadcn components come out themed.

Data marks use a **separate** ramp (`--chart-1` … `--chart-5`). The neon UI
accents sit at OKLCH lightness 0.72–0.86, which is right for text and borders
and too light and too uneven for chart marks; the chart ramp re-steps the same
five hues into the 0.48–0.67 band and is validated for the lightness band,
chroma floor, deuteranopia/protanopia separation, normal-vision separation and
3:1 contrast against the card surface.

## Running it locally

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com), then in the
dashboard open **SQL Editor → New query**, paste all of
[`supabase/schema.sql`](supabase/schema.sql) and run it. That creates:

- `artists` — the dataset, 500 rows
- `artist_profiles` — the write-through cache for live API results
- `genre_stats`, `country_stats`, `decade_stats` — aggregate views the charts read
- row-level security: the public key can read, and nothing else

Fill in from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # publishable / anon key
SUPABASE_SERVICE_ROLE_KEY=         # server-only, never NEXT_PUBLIC_
```

### 3. Load the data

Put the Kaggle CSV at `data/spotify_artists.csv` (it is gitignored — see
[`data/README.md`](data/README.md)), then:

```bash
npm run seed
```

Idempotent: it upserts on `slug`, so re-running is safe.

### 4. Spotify (optional but recommended)

[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) →
**Create app** → **Settings** → copy the client ID and secret:

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

Client-credentials flow only — no user ever signs in, and the app can only
read Spotify's public catalogue.

**If these are blank the site still works.** It falls back to Apple's keyless
iTunes Search API, which returns a real 30-second preview file played through
an inline `<audio>` element. You lose Spotify artist photos, follower counts
and genre tags, and the "biggest track" becomes Apple Music's ranking rather
than Spotify's.

### 5. Run

```bash
npm run dev
```

## Deploying

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new),
and add all five environment variables under **Settings → Environment
Variables**. `.env.local` is gitignored and is not read by Vercel.

## How the live layer works

`src/lib/enrich.ts` is the orchestrator. On first view of an artist:

1. Spotify search resolves the dataset name to an artist — preferring an exact,
   accent-insensitive name match over Spotify's fuzzy relevance order, then
   falling back to whichever candidate has the most followers.
2. `/artists/{id}/top-tracks` returns tracks already in Spotify's popularity
   order, so `[0]` is their biggest right now.
3. Wikipedia supplies the description. Picking the right article is the awkward
   part — a bare name lands on a colour for *Pink* and a disambiguation page for
   *Drake* — so a candidate is only accepted if its title plausibly refers to
   the artist **and** its summary reads like it is about a musician.
4. The assembled row is written to `artist_profiles` and served from there for
   seven days.

Playback uses the Spotify embed rather than an audio element, because Spotify
stopped returning `preview_url` for most tracks: the embed gives a 30-second
preview to signed-out visitors and the full track to anyone whose browser is
signed in to Spotify.

## A note on the numbers

Stream totals are **cumulative lifetime counts frozen when the dataset was
compiled** — not live 2026 figures, and not refreshable, because Spotify
publishes no per-artist lifetime stream count through any public API. Track
names, photos, follower counts, popularity scores and genre tags *are* live.
`/about` spells out which is which, column by column.

Coursework project. Not affiliated with or endorsed by Spotify.
