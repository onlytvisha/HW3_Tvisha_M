"""
YouTube Music - the ranking axis AND the playable half of the pipeline.

Why this exists at all: Spotify stopped returning `popularity`/`followers` in
February 2026 and never returned a usable preview at all, so the source that
used to rank the archive (Deezer) is gone too - it had the same 15-minute
preview-URL-expiry problem and no genre index of its own. YouTube Music has
both a "monthly listeners" figure (the new ranking axis) and an artist's own
"top releases" shelf, already ordered by its own popularity signal, and it is
free to listen to without an account.

Why it is resolved *here*, offline, and not at request time: the official
YouTube Data API allows 10,000 quota units a day and charges 100 per search,
so a site with 2,000 artists would exhaust a day's quota on 100 of them.
ytmusicapi speaks to the YouTube Music web client instead, needs no key and
has no quota, so the whole catalogue can be resolved once and stored.

It is an unofficial client, so the site never depends on it being up: monthly
listeners and up to five tracks are stored columns, and any artist without
them falls back to a plain YouTube Music search URL, which needs nothing at
all.
"""

from __future__ import annotations

import re
import time
import unicodedata
from typing import Any

from ytmusicapi import YTMusic

# Above this many tracks a "top songs" shelf stops being a meaningful
# distinction from a full discography dump.
_MAX_SONGS = 5


def client() -> YTMusic:
    """Unauthenticated YouTube Music. Search needs no cookie or key."""
    return YTMusic()


def _fold(text: str) -> str:
    """Casefold and strip accents and punctuation, for comparing names."""
    stripped = "".join(
        ch
        for ch in unicodedata.normalize("NFD", text)
        if not unicodedata.combining(ch)
    )
    return re.sub(r"[^a-z0-9]", "", stripped.casefold())


def _credits_artist(song: dict[str, Any], artist: str) -> bool:
    """
    Whether `artist` is the *lead* on this song.

    YouTube Music answers a search for "Drake" with "Life Is Good (feat.
    Drake)", which is credited to Future. A listener asking for Drake's
    biggest song does not mean the Future record he guests on, so only the
    first credited artist counts.
    """
    credits = song.get("artists") or []
    if not credits:
        return False
    return _fold(credits[0].get("name", "")) == _fold(artist)


def _parse_count(text: str | None) -> int | None:
    """
    "29.1M" / "3.86M" / "812K" / "1,204" -> an int, or None if unparseable.

    ytmusicapi hands back these as human-formatted strings (or omits the key
    entirely for an artist it tracks no figure for). None is returned rather
    than 0 in every case a real count is not known, so an untracked artist
    stays "unranked" instead of sorting to the bottom as if it had zero
    listeners - the same convention pipeline/store.py already uses for a
    missing follower count.
    """
    if not text:
        return None

    match = re.match(r"([\d,.]+)\s*([KMB]?)", text.strip(), re.IGNORECASE)
    if not match:
        return None

    number = match.group(1).replace(",", "")
    try:
        value = float(number)
    except ValueError:
        return None

    scale = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
    return round(value * scale.get(match.group(2).upper(), 1))


def _thumbnail(song: dict[str, Any]) -> str | None:
    thumbs = song.get("thumbnails") or []
    return thumbs[-1]["url"] if thumbs else None


def find_artist_channel(yt: YTMusic, artist: str) -> str | None:
    """
    The YouTube Music channelId (browseId) for an artist name.

    A get_artist() lookup needs this id first; a plain song/name search does
    not return it. Same exact-fold-match rule the rest of this module uses.
    """
    try:
        results = yt.search(artist, filter="artists", limit=5)
    except Exception as err:  # noqa: BLE001 - unofficial client, any error
        print(f"    ! youtube artist search failed for {artist!r}: {err}")
        return None

    target = _fold(artist)
    for result in results:
        if _fold(result.get("artist", "")) == target and result.get("browseId"):
            return result["browseId"]

    return None


def monthly_listeners_only(yt: YTMusic, artist: str) -> int | None:
    """
    Just the ranking figure, for scoring crawl candidates.

    Cheaper than artist_songs() in spirit if not strictly in network calls -
    both still need one search + one get_artist round trip - but it skips
    building the five-song payload for the thousands of candidates the crawl
    discards, most of which never get written anywhere.
    """
    channel_id = find_artist_channel(yt, artist)
    if not channel_id:
        return None

    try:
        info = yt.get_artist(channel_id)
    except Exception as err:  # noqa: BLE001
        print(f"    ! youtube get_artist failed for {artist!r}: {err}")
        return None

    return _parse_count(info.get("monthlyListeners"))


def artist_songs(yt: YTMusic, artist: str) -> dict[str, Any] | None:
    """
    Monthly listeners and up to five of the artist's biggest songs.

    get_artist()'s `songs` shelf is already ordered by YouTube Music's own
    popularity signal - "top releases" - so no separate ranking call is
    needed, only a filter down to songs this artist actually leads.
    """
    channel_id = find_artist_channel(yt, artist)
    if not channel_id:
        return None

    try:
        info = yt.get_artist(channel_id)
    except Exception as err:  # noqa: BLE001
        print(f"    ! youtube get_artist failed for {artist!r}: {err}")
        return None

    monthly_listeners = _parse_count(info.get("monthlyListeners"))

    songs: list[dict[str, Any]] = []
    shelf = (info.get("songs") or {}).get("results") or []
    for song in shelf:
        if not song.get("videoId") or not _credits_artist(song, artist):
            continue
        songs.append(
            {
                "rank": len(songs) + 1,
                "video_id": song["videoId"],
                "track_name": song.get("title"),
                "thumbnail": _thumbnail(song),
            }
        )
        if len(songs) == _MAX_SONGS:
            break

    if monthly_listeners is None and not songs:
        return None

    result: dict[str, Any] = {"top_songs": songs}
    if monthly_listeners is not None:
        result["monthly_listeners"] = monthly_listeners
    return result


def resolve_all(
    yt: YTMusic,
    artists: list[str],
    pause: float = 0.2,
) -> dict[str, dict[str, Any]]:
    """
    Resolve a list of artist names, keyed by name.

    Sequential and gently paced on purpose: this is an unofficial endpoint
    being used as a guest, and hammering it is both rude and the fastest way
    to get the client blocked. Each artist now costs two round trips (search
    + get_artist) instead of one, so budget roughly twice the wall-clock of
    the old single-song lookup.
    """
    resolved: dict[str, dict[str, Any]] = {}

    for i, name in enumerate(artists, 1):
        info = artist_songs(yt, name)
        if info:
            resolved[name] = info

        if i % 50 == 0 or i == len(artists):
            print(f"  youtube {i}/{len(artists)}  ({len(resolved)} resolved)")
        time.sleep(pause)

    return resolved
