"""
Spotify, via Spotipy - now only for artist portraits and debut years.

This module was written to be the ranking half of the pipeline. It no longer
can be. In **February 2026** Spotify removed `followers`, `popularity` and
`genres` from the artist object for every app in Developer Mode, and made
/artists/{id}/top-tracks answer 403. Verified against this project's own
credentials - /v1/artists/{id} returns exactly:

    external_urls, href, id, images, name, type, uri

Those fields are now available only to integrations granted Extended Quota
Mode, which Spotify awards by application and not to coursework projects. The
ranking therefore moved to YouTube Music's monthly-listeners figure (see
youtube_music.py), and what Spotify is still good for is:

  * **portraits** - `images` survived the cull, and they are good ones
  * **debut year** - /artists/{id}/albums still returns release dates, and the
    earliest is a fair proxy for when an act arrived on streaming
  * **search** - still works, so it can still find artists by name

Auth is the Client Credentials flow: an app-level token, no user login, no
redirect. That is all the endpoints used here need.
"""

from __future__ import annotations

import time
from typing import Any, Iterable, Iterator

import requests
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

from canonical import canonical_genre, match_key

# Search page size. The Web API reference still documents a maximum of 50, but
# the live endpoint rejects anything above 10 with "Invalid limit" - verified
# against this app's own credentials, at 11 and above. Raising this back to 50
# on the strength of the docs will break every crawl request.
_PAGE = 10

# Attempts per request, covering a connection reset partway through a crawl.
_RETRIES = 4


def client() -> spotipy.Spotify:
    """An app-token Spotify client. No user login, no redirect."""
    from config import require_spotify

    client_id, client_secret = require_spotify()
    return spotipy.Spotify(
        client_credentials_manager=SpotifyClientCredentials(
            client_id=client_id, client_secret=client_secret
        ),
        requests_timeout=20,
        # Spotipy retries 429s on its own and honours Retry-After; this just
        # raises how long it is willing to keep trying, because a 2,000-artist
        # crawl will meet the rate limiter at least once.
        retries=8,
        status_retries=8,
        backoff_factor=0.6,
    )


def to_record(artist: dict[str, Any]) -> dict[str, Any]:
    """
    A Spotify artist object, reduced to what the `artists` table can still
    take from it.

    No popularity, followers or genres: those keys are simply absent from the
    response now, and reading them would silently write NULL over the values
    the youtube pass just put there.
    """
    return {
        "spotify_id": artist["id"],
        "name": artist["name"],
        "image_url": image_of(artist),
    }


def image_of(artist: dict[str, Any]) -> str | None:
    """The widest portrait Spotify has, or None. Spotify sorts them widest first."""
    images = artist.get("images") or []
    return images[0]["url"] if images else None


def debut_year(sp: spotipy.Spotify, artist_id: str) -> int | None:
    """
    The year of the artist's earliest album, as a proxy for their debut.

    Not exact - Spotify's catalogue dates reissues and remasters by their
    reissue date, so a 1970s act can look like a 2010s one - but it is the
    only arrival signal left in this API, and it is right far more often than
    it is wrong for artists who came up on streaming.
    """
    years: list[int] = []
    try:
        page = sp.artist_albums(artist_id, album_type="album", limit=_PAGE)
    except spotipy.SpotifyException as err:
        print(f"    ! albums failed for {artist_id}: {err}")
        return None

    for album in (page or {}).get("items", []):
        date = album.get("release_date") or ""
        if len(date) >= 4 and date[:4].isdigit():
            years.append(int(date[:4]))

    return min(years) if years else None


def find_artist(sp: spotipy.Spotify, name: str) -> dict[str, Any] | None:
    """
    Resolve one dataset name to a Spotify artist.

    Prefers an exact name match (accent- and punctuation-insensitive), then
    the most popular of those. Without the exact-match pass, searching for a
    short name like "Shakira" or "Bad Bunny" reliably returns tribute acts,
    karaoke channels and "Bad Bunny Type Beat" producers above the real one,
    all of which are genuinely named that.
    """
    try:
        results = sp.search(q=name, type="artist", limit=_PAGE)
    except (spotipy.SpotifyException, requests.RequestException) as err:
        print(f"    ! search failed for {name!r}: {err}")
        return None

    items = ((results or {}).get("artists") or {}).get("items") or []
    if not items:
        return None

    target = match_key(name)
    exact = [a for a in items if match_key(a["name"]) == target]
    pool = exact or items

    # Spotify's own relevance order is the tiebreak when nothing matches
    # exactly, so pool[0] is the fallback rather than an arbitrary pick.
    return max(pool, key=lambda a: a.get("popularity") or 0) if exact else pool[0]


# Search terms for the crawl. These are Spotify's own genre tags, and the
# `genre:` filter still works even though the artist object no longer reports
# genres - the index kept them. Not all of them resolve: "reggaeton" and
# "afrobeats" return nothing at all now, and "k-pop" returns noise, so the
# crawl treats an empty seed as normal rather than as an error.
CRAWL_SEEDS: tuple[str, ...] = (
    "pop", "dance pop", "hip hop", "rap", "trap", "drill",
    "rock", "classic rock", "indie rock", "punk", "alternative",
    "metal", "metalcore", "r&b", "contemporary r&b", "soul", "funk",
    "country", "folk", "singer-songwriter",
    "edm", "house", "techno", "dubstep", "drum and bass",
    "latin", "urbano latino", "regional mexican", "corrido",
    "sertanejo", "mpb", "bachata", "salsa", "cumbia",
    "j-pop", "amapiano", "reggae", "dancehall",
    "filmi", "punjabi", "turkish pop", "french hip hop",
    "german hip hop", "italian pop", "spanish pop",
)

# Spotify refuses offset + limit > 1000, so no query reaches past its
# thousandth result. 20 pages of 10 is 200 candidates per seed, which is
# plenty to fill the archive and keeps the pass to a few minutes.
_MAX_OFFSET = 990
_PAGES_PER_SEED = 20


def _search_page(
    sp: spotipy.Spotify, query: str, offset: int
) -> list[dict[str, Any]]:
    """
    One page of a search, retried through a dropped connection.

    A full crawl is a few thousand requests over several minutes, and Spotify
    resets the connection somewhere in the middle of that often enough that
    not handling it means the pass dies two thirds of the way through with a
    ConnectionResetError. Spotipy only converts HTTP errors into
    SpotifyException; a reset socket surfaces as a raw requests exception and
    goes straight past an `except SpotifyException`.
    """
    for attempt in range(_RETRIES):
        try:
            results = sp.search(
                q=query, type="artist", limit=_PAGE, offset=offset
            )
            return ((results or {}).get("artists") or {}).get("items") or []
        except spotipy.SpotifyException as err:
            # A 4xx will not fix itself by asking again.
            print(f"    ! {query!r} @ {offset}: {err}")
            return []
        except requests.RequestException as err:
            if attempt == _RETRIES - 1:
                print(f"    ! {query!r} @ {offset} gave up: {err}")
                return []
            time.sleep(2**attempt)

    return []


def crawl(
    sp: spotipy.Spotify, seeds: Iterable[str] = CRAWL_SEEDS
) -> Iterator[tuple[dict[str, Any], str | None]]:
    """
    Walk `genre:"..."` searches and yield (artist, archive genre label).

    Discovery only. What comes back is a name, an id and a portrait - Spotify
    will not say how big any of them are any more, so the caller has to ask
    YouTube Music for a monthly-listeners figure before it can rank or filter
    them. That is why there is no `min_followers` here: there is nothing to
    filter on yet.

    The genre label comes from the seed that found the artist, and it is the
    only genre signal left in this API: the artist object no longer carries
    `genres` at all. Without it every crawled artist would have a null
    primary_genre, be absent from /genres and from the genre charts, and the
    archive would look like it had stopped growing everywhere except the raw
    count.
    """
    seen: set[str] = set()

    for seed in seeds:
        query = f'genre:"{seed}"'
        # The seed is one of Spotify's tags; canonical_genre maps it onto the
        # archive's 23 labels, and returns None for one that has no home there.
        label = canonical_genre([seed])
        found = 0
        last_offset = min(_MAX_OFFSET, (_PAGES_PER_SEED - 1) * _PAGE)

        for offset in range(0, last_offset + 1, _PAGE):
            items = _search_page(sp, query, offset)
            if not items:
                break

            for artist in items:
                if artist["id"] in seen:
                    continue
                seen.add(artist["id"])
                found += 1
                yield artist, label

            if len(items) < _PAGE:
                break
            time.sleep(0.05)

        print(f"  {seed:<20} +{found}{'' if label else '   (no archive genre)'}")
