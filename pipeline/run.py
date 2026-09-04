"""
The Neon Archive data pipeline.

    python pipeline/run.py                 # everything
    python pipeline/run.py --skip-crawl    # refresh what is already there
    python pipeline/run.py --only youtube  # one pass

Three sources, because no single one will do the whole job any more:

    Spotify    discovery (genre search) and portraits, via Spotipy. It can no
               longer report popularity, followers or genres - removed for
               Developer Mode apps in February 2026 - which is why it neither
               ranks nor tags anything below.
    MusicBrainz country, act type and subgenres for the crawled artists, which
               Spotify no longer reports. The slow pass - about two requests a
               second per artist.
    YouTube    both the playable tracks AND the fan-count-shaped ranking
               signal ("monthly listeners"), via ytmusicapi. No quota, no key.

Six passes, each independent enough to skip:

    match        fetch a Spotify portrait for any row still missing one.
    crawl        Spotify genre searches propose artists the CSV never had;
                 YouTube Music's monthly listeners score them; the biggest
                 fill the archive up to PIPELINE_TARGET_ARTISTS.
    musicbrainz  country, act type and subgenres for the crawled artists,
                 which Spotify reports none of. The slow pass - roughly two
                 requests a second.
    youtube      monthly listeners and up to five tracks for every artist.
    write        one upsert per column-shape into public.artists.
    rank         renumber popularity_rank and recompute the 0-100 archive score.

Every pass is idempotent. Re-running updates in place rather than duplicating,
because everything upserts on `slug`.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# The pipeline is run as a script from the repo root, so its own directory is
# not on the path by default.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from canonical import match_key, slugify  # noqa: E402
from config import ConfigError, TARGET_ARTISTS, die  # noqa: E402

PASSES = ("match", "crawl", "musicbrainz", "youtube", "write", "rank")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate public.artists from Spotify, MusicBrainz and YouTube Music.",
    )
    parser.add_argument(
        "--only",
        choices=PASSES,
        action="append",
        help="Run only this pass. Repeatable.",
    )
    for name in PASSES:
        parser.add_argument(
            f"--skip-{name}", action="store_true", help=f"Skip the {name} pass."
        )
    parser.add_argument(
        "--target",
        type=int,
        default=TARGET_ARTISTS,
        help=f"How many artists to aim for in total (default {TARGET_ARTISTS}).",
    )
    parser.add_argument(
        "--refresh-youtube",
        action="store_true",
        help="Re-resolve tracks that already have a video id.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do everything except write to Supabase.",
    )
    return parser.parse_args()


def wanted(args: argparse.Namespace, name: str) -> bool:
    if args.only:
        return name in args.only
    return not getattr(args, f"skip_{name}")


def banner(text: str) -> None:
    print(f"\n=== {text} " + "=" * max(0, 58 - len(text)))


def main() -> None:
    args = parse_args()
    now = datetime.now(timezone.utc).isoformat()

    import store

    sb = store.client()

    existing = store.fetch_all(sb)
    by_slug = {row["slug"]: row for row in existing}
    taken_slugs = set(by_slug)
    claimed_spotify = {r["spotify_id"] for r in existing if r.get("spotify_id")}

    print(f"public.artists currently holds {len(existing)} rows.")

    # Accumulates partial records keyed by slug, merged and written in one go
    # by the write pass. Keeping it in memory means a failed later pass costs
    # nothing that has already been written.
    pending: dict[str, dict[str, Any]] = {}

    def stage(slug: str, fields: dict[str, Any]) -> None:
        pending.setdefault(slug, {"slug": slug}).update(fields)

    # ------------------------------------------------------------- match --
    # A Spotify portrait for any row that still lacks one. The fan-count
    # refresh that used to happen here moved to the youtube pass, since
    # monthly listeners and tracks now come from the same YouTube Music call.
    if wanted(args, "match"):
        import spotify_source
        from cache import Cache

        sp = spotify_source.client()

        needs_image = [r for r in existing if not r.get("spotify_id")]
        banner(f"match: {len(needs_image)} artists still need a Spotify portrait")

        image_memo = Cache("spotify_images")

        for i, row in enumerate(needs_image, 1):
            name = row["name"]
            if name in image_memo:
                record = image_memo.get(name)
            else:
                artist = spotify_source.find_artist(sp, name)
                record = (
                    {
                        "spotify_id": artist["id"],
                        "image_url": spotify_source.image_of(artist),
                    }
                    if artist
                    else None
                )
                image_memo.set(name, record)

            if record and record.get("spotify_id") not in claimed_spotify:
                claimed_spotify.add(record["spotify_id"])
                # Never overwrite an image the row already has.
                if row.get("image_url"):
                    record = {"spotify_id": record["spotify_id"]}
                stage(row["slug"], record)

            if i % 50 == 0 or i == len(needs_image):
                print(f"  spotify portraits {i}/{len(needs_image)}")
        image_memo.flush()

    # ------------------------------------------------------------- crawl --
    # Discovery and ranking come from different places, because neither source
    # can do both:
    #
    #   Spotify       can still search by genre and page deeply, so it finds
    #                 acts the CSV never listed - but will not say how big any
    #                 of them are.
    #   YouTube Music publishes a monthly-listeners figure for any artist you
    #                 can name, but has no queryable genre index, so it cannot
    #                 broaden the set on its own.
    #
    # So Spotify proposes and YouTube Music scores.
    if wanted(args, "crawl"):
        import spotify_source
        import youtube_music
        from cache import Cache

        room = args.target - len(existing)
        banner(f"crawl: room for {room} more artists (target {args.target})")

        if room <= 0:
            print("  already at target; nothing to crawl")
        else:
            sp = spotify_source.client()
            yt = youtube_music.client()

            existing_keys = {match_key(r["name"]) for r in existing}

            candidates: dict[str, tuple[dict[str, Any], str | None]] = {}
            for artist, label in spotify_source.crawl(sp):
                # A crawl hit whose name matches a row already in the table is
                # the same act under a different spelling. Skipping is safer
                # than merging: two archive pages for one artist is worse than
                # one missing id.
                key = match_key(artist["name"])
                if key in existing_keys or key in candidates:
                    continue
                if artist["id"] in claimed_spotify:
                    continue
                candidates[key] = (artist, label)

            print(f"\n  Spotify proposed {len(candidates)} new names")
            print(f"  asking YouTube Music for monthly listeners (~1s each)...")

            listeners_memo = Cache("youtube_listeners")
            pool: list[dict[str, Any]] = []

            for i, (artist, label) in enumerate(candidates.values(), 1):
                name = artist["name"]
                if name in listeners_memo:
                    monthly_listeners = listeners_memo.get(name)
                else:
                    monthly_listeners = youtube_music.monthly_listeners_only(yt, name)
                    listeners_memo.set(name, monthly_listeners)

                if monthly_listeners is not None:
                    pool.append(
                        {
                            "name": name,
                            "spotify_id": artist["id"],
                            "image_url": spotify_source.image_of(artist),
                            "primary_genre": label,
                            "monthly_listeners": monthly_listeners,
                        }
                    )

                if i % 100 == 0 or i == len(candidates):
                    print(f"  youtube {i}/{len(candidates)}  ({len(pool)} matched)")
            listeners_memo.flush()

            # Listener order, so a smaller target keeps the biggest names
            # rather than whichever genre seed happened to run first. YouTube
            # Music monthly listeners run one to two orders of magnitude above
            # the Deezer fan counts this floor used to be tuned against.
            keep = sorted(pool, key=lambda r: -(r.get("monthly_listeners") or 0))
            keep = [
                r for r in keep if (r.get("monthly_listeners") or 0) >= 1_000_000
            ][:room]
            print(f"  keeping the top {len(keep)}")

            for record in keep:
                slug = store.unique_slug(slugify(record["name"]), taken_slugs)
                taken_slugs.add(slug)
                # Drop keys with nothing in them rather than writing NULLs -
                # see the note in store.upsert about column shapes.
                clean = {k: v for k, v in record.items() if v is not None}
                stage(slug, {**clean, "source": "spotify", "synced_at": now})

    # ------------------------------------------------------- musicbrainz --
    if wanted(args, "musicbrainz"):
        import musicbrainz
        from cache import Cache

        # Every artist that still has no country OR no subgenres, whether it
        # was staged by this run's crawl or inserted by an earlier one.
        # Reading only from `pending` would make `--only musicbrainz` a
        # no-op, and would leave any artist whose run was interrupted before
        # this pass permanently without one. The Kaggle 500 already have a
        # country (though not subgenres) - which matters, because this pass
        # now costs roughly two requests a second per artist looked up.
        def needs_backfill(row: dict[str, Any]) -> bool:
            return not row.get("country") or not row.get("subgenres")

        needs = [
            (slug, rec["name"])
            for slug, rec in pending.items()
            if rec.get("name") and needs_backfill(by_slug.get(slug, {}))
        ]
        staged = {slug for slug, _ in needs}
        needs.extend(
            (row["slug"], row["name"])
            for row in existing
            if needs_backfill(row) and row["slug"] not in staged
        )
        memo = Cache("musicbrainz")
        fresh = [pair for pair in needs if pair[1] not in memo]

        banner(
            f"musicbrainz: {len(needs)} artists need a country/subgenres "
            f"({len(needs) - len(fresh)} cached, {len(fresh)} to fetch at ~2s each)"
        )

        session = musicbrainz.session() if fresh else None
        for i, (slug, name) in enumerate(needs, 1):
            if name in memo:
                info = memo.get(name)
            else:
                info = musicbrainz.lookup(session, name)
                memo.set(name, info)

            if info:
                stage(slug, info)

            if i % 25 == 0 or i == len(needs):
                print(f"  musicbrainz {i}/{len(needs)}")
        memo.flush()

    # ----------------------------------------------------------- youtube --
    # Monthly listeners (the ranking signal) and up to five tracks, both from
    # one get_artist() call per artist. Refreshed every run by default, since
    # a listener count is the thing that goes stale - --refresh-youtube forces
    # the same for artists that already have tracks resolved.
    if wanted(args, "youtube"):
        import youtube_music
        from cache import Cache

        targets: list[tuple[str, str]] = []
        for slug, rec in pending.items():
            if rec.get("name"):
                targets.append((slug, rec["name"]))
        for row in existing:
            if row["slug"] in pending:
                continue
            if row.get("top_songs") and not args.refresh_youtube:
                continue
            targets.append((row["slug"], row["name"]))

        # v2: the cache shape grew from a single {video_id, track_name} to
        # {monthly_listeners, top_songs}; a differently-named cache means a
        # leftover file from before this migration is simply ignored rather
        # than misread as the new shape.
        memo = Cache("youtube_v2")
        if args.refresh_youtube:
            memo.data.clear()

        fresh = [pair for pair in targets if pair[1] not in memo]
        banner(
            f"youtube: {len(targets)} artists "
            f"({len(targets) - len(fresh)} cached, {len(fresh)} to fetch at ~1.5s each)"
        )

        yt = youtube_music.client() if fresh else None
        hits = 0
        for i, (slug, name) in enumerate(targets, 1):
            if name in memo:
                info = memo.get(name)
            else:
                info = youtube_music.artist_songs(yt, name)
                memo.set(name, info)

            if info:
                stage(slug, info)
                hits += 1

            if i % 50 == 0 or i == len(targets):
                print(f"  youtube {i}/{len(targets)}  ({hits} resolved)")
        memo.flush()

    # ------------------------------------------------------------- write --
    if wanted(args, "write"):
        banner(f"write: {len(pending)} artists")

        records = list(pending.values())

        # Every record needs a name, even one that is only updating a column
        # on a row that already exists. An upsert is an INSERT with an ON
        # CONFLICT clause, and Postgres checks the NOT NULL constraints
        # against the tuple being inserted - before it discovers the conflict
        # and switches to an update - so a payload without `name` is rejected
        # outright with 23502.
        #
        # For an existing row the name written back is the one already stored,
        # read at the top of this run. That matters: the dataset spells acts
        # its own way, and filling this in from Spotify would quietly rename
        # 500 artists as a side effect of updating their follower count.
        for record in records:
            if "name" in record:
                continue

            known = by_slug.get(record["slug"])
            if not known:
                die(f"refusing to insert {record['slug']!r} with no name")
            record["name"] = known["name"]

        if args.dry_run:
            print("  --dry-run: not writing")
            for record in records[:5]:
                print(f"    {record}")
        else:
            store.upsert(sb, records, label="artists")

    # -------------------------------------------------------------- rank --
    if wanted(args, "rank"):
        banner("rank: renumbering popularity_rank")
        if args.dry_run:
            print("  --dry-run: not writing")
        else:
            n = store.assign_popularity_ranks(sb)
            print(f"  ranked {n} artists")

    banner("done")
    if not args.dry_run:
        total = len(store.fetch_all(sb))
        print(f"public.artists now holds {total} rows.")
        print("\nRun supabase/lock-artists.sql to revoke the write policy.")


if __name__ == "__main__":
    try:
        main()
    except ConfigError as err:
        die(str(err))
    except KeyboardInterrupt:
        print("\ninterrupted; nothing further written", file=sys.stderr)
        raise SystemExit(130) from None
