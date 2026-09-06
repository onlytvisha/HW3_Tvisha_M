# Neon Archive

An archive of streaming artists, ranked by how big they are **right now**.
Each artist page pairs a live monthly-listener count with their top 5 tracks
right now — artwork, genre and subgenre tags, a short description, thirty
seconds playable in the page on a spinning pair of vinyl disks, and the whole
song a click away on Deezer.

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

Coursework project. Not affiliated with Spotify, Apple or YouTube.

<img width="626" height="319" alt="image" src="https://github.com/user-attachments/assets/b126daf5-d883-4d25-8001-4968f80d2f51" />
<img width="587" height="254" alt="image" src="https://github.com/user-attachments/assets/82dfba2e-2121-4ae7-bb2e-6af0308da624" />
<img width="566" height="305" alt="image" src="https://github.com/user-attachments/assets/91794c0a-1fb3-4e54-bbfc-4bfdb6fe2e7a" />

