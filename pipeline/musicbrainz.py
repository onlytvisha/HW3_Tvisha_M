"""
MusicBrainz - country, act type and subgenres for crawled artists.

The archive's country filter and its "Solo / Group" split predate Spotify, and
Spotify has no field for either: an artist object carries genres, popularity,
followers and images, and nothing about where the act is from or whether it is
one person. Without a backfill every crawled artist would sit outside the
country chart and show a blank act type, so a 2,000-row archive would have
country data for only the original 500. The same backfill also supplies
subgenres, since Spotify's own `genres` field has been empty for every artist
object since February 2026.

MusicBrainz is the open music encyclopedia, has all three, and needs no key.
What it does need is a real User-Agent and no more than one request a second -
that limit is enforced, and ignoring it earns a 503. At 1/s this is the slow
step of the pipeline by a wide margin, which is why it is resumable and can be
skipped entirely with --skip-musicbrainz.

Country/type/gender come from the search response itself. Subgenres are one
request further in: MusicBrainz's *curated* genre vocabulary (as opposed to
its noisier free-form tag folksonomy, which the search response also carries
but which is skipped here for cleaner data) is only available from a
lookup-by-MBID call (`inc=genres`), so a match costs a second throttled
request - doubling this pass's wall-clock time, but only once per artist ever,
since pipeline/.cache/musicbrainz.json remembers the result forever.
"""

from __future__ import annotations

import time
from typing import Any

import requests

from canonical import canonical_country, match_key

_ENDPOINT = "https://musicbrainz.org/ws/2/artist"

# MusicBrainz asks for one request per second from anonymous clients and means
# it. 1.1 leaves headroom for clock drift rather than riding the limit exactly.
_MIN_INTERVAL = 1.1

# Below this the match is a coincidence rather than the artist. MusicBrainz
# scores 100 for an exact name hit and drops fast; 90 keeps punctuation and
# accent variants and rejects "The Beatles" for a search for "Beatles Tribute".
_MIN_SCORE = 90

# Attempts per request, covering a busy-service 503 or a dropped connection.
_RETRIES = 4

# How many of MusicBrainz's curated genre tags to keep, most-counted first.
_MAX_SUBGENRES = 5

_last_call = 0.0


def _throttled_get(
    session: requests.Session, params: dict[str, Any], url: str = _ENDPOINT
) -> Any:
    """
    One request, never sooner than _MIN_INTERVAL after the previous one.

    503 is MusicBrainz's "slow down", and it arrives even on a well-behaved
    first request when the service is busy. It is retried with a growing
    backoff rather than once, because a single dropped response here is an
    artist that silently ends up with no country - a miss that looks exactly
    like "MusicBrainz has never heard of them" and is impossible to tell
    apart afterwards.
    """
    global _last_call

    for attempt in range(_RETRIES):
        wait = _MIN_INTERVAL - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)

        try:
            response = session.get(url, params=params, timeout=20)
            _last_call = time.monotonic()
        except requests.RequestException as err:
            _last_call = time.monotonic()
            if attempt == _RETRIES - 1:
                print(f"    ! musicbrainz request failed: {err}")
                return None
            time.sleep(2**attempt)
            continue

        if response.status_code == 503:
            time.sleep(2**attempt)
            continue
        if not response.ok:
            return None

        try:
            return response.json()
        except ValueError:
            return None

    return None


def session() -> requests.Session:
    from config import MUSICBRAINZ_UA

    s = requests.Session()
    s.headers.update({"User-Agent": MUSICBRAINZ_UA, "Accept": "application/json"})
    return s


def lookup(s: requests.Session, name: str) -> dict[str, Any] | None:
    """
    Country, act type and listed gender for one artist name.

    Returns only the fields MusicBrainz actually had - an artist with no
    country in the database yields a dict without a `country` key rather than
    one with None, so a caller can tell "unknown" from "not looked up".
    """
    data = _throttled_get(
        s,
        {"query": f'artist:"{name}"', "fmt": "json", "limit": 5},
    )
    if not data:
        return None

    target = match_key(name)
    candidates = [
        a
        for a in data.get("artists", [])
        if (a.get("score") or 0) >= _MIN_SCORE and match_key(a.get("name", "")) == target
    ]
    if not candidates:
        return None

    best = candidates[0]
    result: dict[str, Any] = {}

    country = canonical_country(best.get("country"))
    if country:
        result["country"] = country

    # MusicBrainz types are Person / Group / Orchestra / Choir / Character /
    # Other. The archive only has two buckets, and everything that is not one
    # human is a Group as far as the filter is concerned.
    mb_type = best.get("type")
    if mb_type == "Person":
        result["artist_type"] = "Solo"
    elif mb_type in ("Group", "Orchestra", "Choir"):
        result["artist_type"] = "Group"

    # The dataset's column is "Sex" with values Male / Female / Mixed. It only
    # means anything for a solo act, so a group is left alone rather than
    # labelled from the gender of whoever MusicBrainz happened to list.
    gender = (best.get("gender") or "").casefold()
    if mb_type == "Person" and gender in ("male", "female"):
        result["sex"] = gender.capitalize()

    mbid = best.get("id")
    if mbid:
        subgenres = _lookup_genres(s, mbid)
        if subgenres:
            result["subgenres"] = subgenres

    return result or None


def _lookup_genres(s: requests.Session, mbid: str) -> list[str]:
    """
    Curated genre tags for one artist, most-counted first.

    A second, throttled request against the lookup-by-MBID endpoint (search
    results carry a noisier free-form tag folksonomy, not this curated list).
    Cached forever alongside the rest of lookup()'s result, so this only ever
    costs real time once per artist.
    """
    data = _throttled_get(
        s, {"inc": "genres", "fmt": "json"}, url=f"{_ENDPOINT}/{mbid}"
    )
    if not data:
        return []

    genres = sorted(
        data.get("genres", []), key=lambda g: g.get("count", 0), reverse=True
    )
    return [g["name"].title() for g in genres[:_MAX_SUBGENRES] if g.get("name")]


def backfill(
    s: requests.Session,
    names: list[str],
) -> dict[str, dict[str, Any]]:
    """Look up many names, keyed by name. About one second each - see module docstring."""
    found: dict[str, dict[str, Any]] = {}

    for i, name in enumerate(names, 1):
        info = lookup(s, name)
        if info:
            found[name] = info

        if i % 25 == 0 or i == len(names):
            remaining = (len(names) - i) * _MIN_INTERVAL
            print(
                f"  musicbrainz {i}/{len(names)}  ({len(found)} found, "
                f"~{remaining / 60:.0f} min left)"
            )

    return found
