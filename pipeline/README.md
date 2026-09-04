# The data pipeline

Offline Python that fills `public.artists`. Run it when you want the archive
refreshed or widened; the Next.js site only ever reads what it leaves behind.

```bash
python -m pip install -r pipeline/requirements.txt
python pipeline/run.py
```

## Why there is a Python pipeline at all

Three of the four things the archive needs are cheap offline and impossible at
request time:

- **YouTube Music** has no official API. The YouTube Data API gives 10,000
  quota units a day and charges 100 per search, so a site with 2,000 artists
  would burn a whole day's quota on 100 of them. `ytmusicapi` talks to the
  YouTube Music web client instead — no key, no quota — so every artist's
  monthly-listener figure and top tracks are resolved once here and stored as
  columns.
- **MusicBrainz** is capped at one request per second, and resolving
  subgenres costs a second request per artist beyond the country/type lookup
  — two thousand artists is the better part of an hour, which is fine for a
  job you run occasionally and impossible inside a page render.
- **Spotify** is only reachable with a client secret, which must never go near
  the browser.

## What each source is for

| Source | Gives | Notes |
| ------ | ----- | ----- |
| **YouTube Music** | `monthly_listeners` (the ranking axis), `top_songs` (up to 5 tracks) | Keyless, unrestricted, via `ytmusicapi` |
| **Spotify** | artist ids, portraits, genre-search discovery | Client Credentials via Spotipy; see the warning below |
| **MusicBrainz** | country, act type, listed gender, curated `subgenres` | Keyless, 1 req/sec, needs a real User-Agent |

### ⚠ Spotify cannot rank artists any more

This pipeline was written to rank the archive on Spotify's `popularity` score
and `followers` count. **It cannot.** In **February 2026** Spotify removed both
fields from the artist object for every app in Developer Mode, along with
`genres`, and made `/artists/{id}/top-tracks` return 403.

Verified against this project's own credentials — `GET /v1/artists/{id}`
returns exactly:

```json
["external_urls", "href", "id", "images", "name", "type", "uri"]
```

Two further live constraints, both of which will silently break code written
from the current documentation:

- **`limit` on `/v1/search` is capped at 10**, not the documented 50. Anything
  above 10 returns `400 Invalid limit`.
- `offset + limit` may not exceed 1000, so no query reaches past its
  thousandth result.

Those fields are available only to integrations holding **Extended Quota
Mode**, which Spotify grants by application and review — not to a coursework
project. So the ranking moved to YouTube Music's `monthlyListeners`, which is
the same shape of signal, keyless and unrestricted. Spotify still earns its
place: it has the best portraits, and its `genre:"..."` search filter still
works even though artist objects no longer report genres, which is what lets
the crawl find acts the Kaggle CSV never listed.

### ⚠ YouTube Music cannot broaden the archive by genre

The mirror-image limitation: YouTube Music's genre and mood shelves are
curated editorial playlists, not a queryable genre index, so there is no
endpoint here that answers "give me artists in genre X." **Spotify proposes,
YouTube Music scores.** Neither can do the whole job alone.

## The six passes

Each is skippable (`--skip-crawl`) or isolatable (`--only youtube`), and all of
them are idempotent — everything upserts on `slug`.

| Pass | What it does | Roughly |
| ---- | ------------ | ------- |
| `match` | fetch a Spotify portrait for any row missing one | seconds to minutes, depending how many are missing |
| `crawl` | Spotify genre searches propose new artists; YouTube Music's monthly listeners score them; the biggest fill the archive up to `--target` | ~1s/candidate |
| `musicbrainz` | country, act type and subgenres for crawled artists | ~2 sec each (two requests per artist for the curated subgenre lookup) |
| `youtube` | monthly listeners and up to 5 tracks for every artist | ~1.5 sec each (search + get_artist) |
| `write` | one upsert per column shape | seconds |
| `rank` | renumber `popularity_rank`, recompute the 0–100 archive score | seconds |

```bash
python pipeline/run.py --target 2000        # everything
python pipeline/run.py --skip-crawl         # just refresh what is there
python pipeline/run.py --only youtube --only write
python pipeline/run.py --dry-run            # resolve everything, write nothing
```

### The lookup cache

MusicBrainz and YouTube Music results are written through to
`pipeline/.cache/*.json` **as they resolve**, keyed by artist name. Both passes
finish before anything reaches Supabase, so without this a failure in `write`
threw away time spent on lookups. A re-run only asks the network about names it
has never seen. The directory is gitignored; delete it to force a refetch. The
YouTube Music cache is named `youtube_v2.json` — the shape grew from one
track to a listener figure plus up to five, so a differently-named file means
a leftover cache from before that change is simply ignored rather than
misread.

## What "archive score" means

`popularity` holds the artist's **percentile by YouTube Music monthly
listeners within the archive**: 100 is the most-listened-to artist here, 50
the median.

It exists because raw listener counts span five orders of magnitude, so a
meter drawn from them is a full bar for Drake and an invisible sliver for
everyone else. Being a percentile, it shifts as the archive grows — which is
recorded in a `comment on column` in `supabase/schema-v4-youtube-ranking.sql`,
so it is visible from the Supabase table editor and not only from here.

## Setup

`.env.local` (the same file the site uses, and gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Spotify credentials come from
[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) —
create an app, any name; the redirect URI is required by the form but unused
by the Client Credentials flow. **Server-side only:** no `NEXT_PUBLIC_` prefix,
so Next.js never inlines them into the browser bundle. The site itself does not
read them; only this pipeline does, via [Spotipy](https://spotipy.readthedocs.io/),
the official Python client for the Spotify Web API.

The migrations in `supabase/` must be applied first, in order:
`schema.sql` → `schema-v2-spotify.sql` → `schema-v3-deezer-ranking.sql` →
`schema-v4-youtube-ranking.sql`. Run `supabase/lock-artists.sql` afterwards to
revoke the temporary write policy the pipeline needs.
