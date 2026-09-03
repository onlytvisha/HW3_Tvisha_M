# Neon Archive

A synthwave archive of 500 streaming artists. Each artist page pairs their
historical stream statistics from a Kaggle dataset with their **current
biggest track** — artwork, genre, a short description, and 30 seconds of the
song playing in the page.

Next.js 16 · shadcn/ui · Supabase Postgres · deployed on Vercel.

**No API keys.** Every catalogue source is public and keyless, so the whole
configuration is two Supabase variables.

## What it does

| Page              | What is on it                                                          |
| ----------------- | ---------------------------------------------------------------------- |
| `/`               | Hero stats, the #1 artist, the rest of the top 13, genre rail           |
| `/artists`        | All 500, filterable by genre / country / act type, sortable, paginated  |
| `/artists/[slug]` | One artist: the player, description, genre tags, and their statistics   |
| `/charts`         | Streams by genre and country, debuts by decade — each with a table view |
| `/about`          | Every column's provenance, and which figures are live vs. frozen        |

## Where the music comes from

Three public APIs, none of which needs a credential.

**Deezer** owns the track, because it is the only keyless source that
publishes a popularity rank. Two of its quirks are worked around in
`src/lib/deezer.ts`:

- Artist search returns impostors — a search for Rihanna surfaces a 752-fan
  account above the real one — so an exact, accent-insensitive name match wins,
  then most fans.
- `/artist/{id}/top` is neither sorted by rank nor filtered to the artist,
  despite the name. Lead tracks beat features, then highest rank wins.

**iTunes** supplies the genre tag (Apple files each artist under one clean
canonical label) and stands in for the track if Deezer draws a blank. It
cannot answer the ranking question: no iTunes endpoint exposes a popularity
score, and both the lookup and search orderings blend relevance with recency,
which is how you end up offering a Future song as Drake's biggest.

**Wikipedia** supplies the description. Picking the right article is the
awkward part — a bare name lands on a colour for *Pink* and a disambiguation
page for *Drake* — so a candidate is accepted only if its title plausibly
refers to the artist **and** its summary reads like it is about music.

Results are written to `artist_profiles` and served from there for seven days,
so a repeat visit costs one Supabase read instead of five outbound calls.

## Design

The palette is daisyUI's `synthwave` theme, applied by pointing shadcn/ui's
design tokens at it in `src/app/globals.css` rather than restyling components
one by one — so the stock shadcn components come out themed.

Data marks use a **separate** ramp (`--chart-1` … `--chart-5`). The neon UI
accents sit at OKLCH lightness 0.72–0.86, which is right for text and borders
and too light and too uneven for chart marks; the chart ramp re-steps the same
five hues into the 0.48–0.67 band and is validated for the lightness band,
chroma floor, deuteranopia/protanopia separation (worst adjacent pair ΔE 10.3),
normal-vision separation (17.7) and 3:1 contrast against the card surface.

### Two themes

Neon is the default. **Paper** — cream ground, ink text, no glow — is one
click away in the header, for reading rather than being impressed at.

Because every shadcn token in `:root` is declared as `var(--sw-*)`, paper
only restates the raw palette; the whole component layer re-themes for free.
Four extra rules retire the effects that are decorative rather than
structural and that no recolouring would calm: the horizon grid, the text
glow, the two background blooms, and the neon card-hover bloom.

Two things needed real work rather than a token swap:

- **The chart ramp is re-stepped, not reused.** The dark ramp lives in the
  OKLCH band 0.48–0.67, which is what stops marks sinking into a near-black
  card and is far too dark on cream. Paper's ramp puts the same five hues in
  the light band 0.43–0.77 and clears every check against the cream card
  (worst adjacent pair ΔE 13.5 protan, 23.2 normal-vision, all five ≥ 3:1).
- **Monogram tiles are cut with the surface.** They carry black initials, so
  they need a light ground; paper's accents are deep, so `--sw-tile-strength`
  drops them to a 30% tint. On neon it is 100% and nothing changes.

The choice is stored in `localStorage` and applied by a small inline script
in `<head>` before first paint — without it, a stored preference only lands
at hydration and every navigation flashes near-black before turning cream.
The script also drops the `dark` class, since shadcn's `dark:` variants are
refinements written for a dark ground.

## Running it locally

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com), then open
**SQL Editor → New query**, paste all of
[`supabase/schema.sql`](supabase/schema.sql) and run it. That creates:

- `artists` — the dataset, 500 rows
- `artist_profiles` — the write-through cache for live API results
- `genre_stats`, `country_stats`, `decade_stats` — the views the charts read
- row-level security: the publishable key can read everything and write only
  the profile cache

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

Idempotent: it upserts on `slug`, so re-running is safe. Afterwards run
[`supabase/lock-artists.sql`](supabase/lock-artists.sql) to revoke the
temporary write grant the seed needed.

### 4. Run

```bash
npm run dev
```

## Deploying

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new),
and add the two `NEXT_PUBLIC_SUPABASE_*` variables under **Settings →
Environment Variables**. `.env.local` is gitignored and is not read by Vercel.

## Security notes

RLS grants the publishable key `select` on both tables, and `insert`/`update`
on `artist_profiles` only. That last grant is what lets the deployed site run
with no server-side secret: the cache is written at request time from the
browser-visible key.

The exposure is bounded and self-healing — every column in that table is
regenerated from the public APIs on the next refresh, none of it is user data,
and the dataset itself stays read-only. Setting `SUPABASE_SERVICE_ROLE_KEY`
makes the app prefer a privileged key instead, at which point those two
policies can be dropped.

## A note on the numbers

Stream totals are **cumulative lifetime counts frozen when the dataset was
compiled** — not live 2026 figures, and not refreshable, because no streaming
service publishes a per-artist lifetime stream count through a public API. The
track, artwork, fan count and genre tags *are* live. `/about` spells out which
is which, column by column, and the UI keeps the two visually separated.

Coursework project. Not affiliated with Deezer, Apple or Spotify.
