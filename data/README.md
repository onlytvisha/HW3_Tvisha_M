# Dataset

`spotify_artists.csv` — **Spotify Music Artist Streaming Analytics** (Kaggle),
500 artists x 14 columns, no missing values.

The CSV is gitignored. To reproduce the database:

1. Download the dataset from Kaggle and save it here as `spotify_artists.csv`.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. `npm run seed`

## Columns

| CSV column                            | Column in `public.artists` |
| ------------------------------------- | -------------------------- |
| Artist Name                           | `name` (+ derived `slug`)  |
| Sex                                   | `sex`                      |
| Country of Origin                     | `country`                  |
| Primary Language                      | `language`                 |
| Primary Genre                         | `primary_genre`            |
| Artist Type                           | `artist_type`              |
| Debut Year                            | `debut_year`               |
| Total Streams (in millions)           | `total_streams_m`          |
| Lead Streams (in millions)            | `lead_streams_m`           |
| Feature Streams (in millions)         | `feature_streams_m`        |
| Solo Streams (in millions)            | `solo_streams_m`           |
| % of Solo Streams                     | `solo_pct`                 |
| Collaborative Streams (in millions)   | `collab_streams_m`         |
| % of Collaborative Streams            | `collab_pct`               |
| —                                     | `stream_rank` (derived)    |

## A note on freshness

These are **historical cumulative** stream totals as published in the dataset,
not live 2026 figures. Spotify does not publish per-artist lifetime stream
counts, so the numbers cannot be refreshed from an API and will drift further
from reality over time. Treat them as a fixed snapshot.

Anything the site shows as *live* — artist photo, follower count, Spotify
genre tags, the current #1 track — is fetched at request time from the Spotify
Web API and is genuinely current. The two are visually separated in the UI.
