"""
Reading and writing public.artists from the pipeline.

Everything here upserts on `slug`, which is why canonical.slugify() has to stay
byte-identical to the one in scripts/seed.ts: the 500 Kaggle rows are already
in the table under slugs that script produced, and the pipeline has to land on
the same string to update them rather than insert a second copy beside them.

PostgREST builds `ON CONFLICT DO UPDATE SET` from the keys present in the
payload, so a partial record updates only the columns it carries. That is what
lets the youtube pass write popularity and monthly_listeners onto a Kaggle row
without touching its stream totals.
"""

from __future__ import annotations

from typing import Any, Iterable

from supabase import Client, create_client

# PostgREST will take more, but a failed 1,000-row upsert reports one error for
# the whole batch and says nothing about which row caused it. 100 keeps the
# blast radius small enough to debug.
CHUNK = 100


def client() -> Client:
    from config import require_supabase

    url, key = require_supabase()
    return create_client(url, key)


def fetch_all(sb: Client) -> list[dict[str, Any]]:
    """
    Every artist already in the table.

    Paged explicitly: PostgREST caps a response at 1,000 rows by default, and
    the whole point of this pipeline is a table larger than that, so a single
    select would silently return a truncated picture and the rank pass would
    renumber the archive against a third of it.
    """
    rows: list[dict[str, Any]] = []
    page = 0

    while True:
        start = page * 1000
        result = (
            sb.table("artists")
            .select("id, slug, name, source, spotify_id, "
                    "popularity, monthly_listeners, country, "
                    "artist_type, primary_genre, subgenres, image_url")
            .order("id")
            .range(start, start + 999)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)

        if len(batch) < 1000:
            return rows
        page += 1


def upsert(sb: Client, records: list[dict[str, Any]], label: str = "rows") -> None:
    """
    Upsert on slug, in chunks, reporting progress.

    Records are grouped by their exact key set before being sent, because a
    bulk upsert is one INSERT statement with one column list: PostgREST takes
    the columns from the payload and rejects a batch whose objects disagree
    about which keys they have. The pipeline produces exactly that - an artist
    MusicBrainz answered for carries `country`, the one beside it does not.

    Grouping rather than padding is the point. Padding the short records with
    None would make them the same shape, and would also write those NULLs over
    whatever those columns already held, so a MusicBrainz miss would erase a
    country the CSV had supplied. Columns absent from a group's payload are
    left alone by `ON CONFLICT DO UPDATE`, which is the behaviour wanted.
    """
    if not records:
        print(f"  nothing to write for {label}")
        return

    groups: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    for record in records:
        groups.setdefault(tuple(sorted(record)), []).append(record)

    if len(groups) > 1:
        print(f"  {label}: {len(groups)} column shapes across {len(records)} rows")

    written = 0
    for shape, group in groups.items():
        for i in range(0, len(group), CHUNK):
            chunk = group[i : i + CHUNK]
            try:
                sb.table("artists").upsert(chunk, on_conflict="slug").execute()
            except Exception as err:  # noqa: BLE001 - surface the shape and range
                raise RuntimeError(
                    f"upsert failed at {label} rows {i}-{i + len(chunk)} "
                    f"with columns {list(shape)}: {err}"
                ) from err

            written += len(chunk)
            print(f"  {label}: {written}/{len(records)}")


def assign_popularity_ranks(sb: Client) -> int:
    """
    Renumber `popularity_rank` and recompute `popularity` across the table.

    Both are derived from `monthly_listeners` - YouTube Music's own listener
    figure - because that is the only live size signal the archive has, now
    that both Spotify (Feb 2026) and Deezer (this migration) are out of the
    ranking business:

      popularity_rank  1 = most-listened-to artist in the table.
      popularity       the artist's percentile by monthly listeners, 0-100.
                       This is the archive's own score, not any provider's.
                       It exists because raw listener counts span five orders
                       of magnitude, so a meter drawn from them is a full bar
                       for Drake and an invisible sliver for everyone else; a
                       percentile is readable at every size.

    Both therefore shift as the archive grows, which is a property of a
    percentile and is documented on the column itself in migration 4.

    An artist with no listener count - one neither source could match - gets
    NULL for both rather than being crowded onto the end, so the UI can tell
    "unranked" from "ranked last".
    """
    rows = fetch_all(sb)
    ranked = sorted(
        (r for r in rows if r.get("monthly_listeners") is not None),
        key=lambda r: -(r["monthly_listeners"] or 0),
    )

    n = len(ranked)
    updates = []
    for i, row in enumerate(ranked, 1):
        # i = 1 is the most-followed, and should score 100; i = n scores 0.
        score = 100 if n <= 1 else round(((n - i) / (n - 1)) * 100)
        updates.append(
            {"slug": row["slug"], "popularity_rank": i, "popularity": score}
        )

    upsert(sb, updates, label="ranks")

    unranked = len(rows) - n
    if unranked:
        print(f"  {unranked} artists left unranked (no monthly listener count)")
    return n


def unique_slug(base: str, taken: Iterable[str] | set[str]) -> str:
    """
    A slug not already in `taken`.

    Same collision rule as scripts/seed.ts - "-2", "-3" and so on - so a name
    that collides behaves identically whichever loader inserted it.
    """
    taken = taken if isinstance(taken, set) else set(taken)
    if base not in taken:
        return base

    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"
