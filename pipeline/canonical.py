"""
Normalising the crawl onto the vocabulary the site already groups on.

Spotify and MusicBrainz both describe an artist far more finely than the site
does. Spotify files Bad Bunny under "reggaeton, trap latino, urbano latino"
and Drake under "canadian hip hop, rap, hip hop"; MusicBrainz reports a
two-letter country code. The archive has 23 genre labels and 43 country names
and the charts group on them, so a crawled artist has to land on one of each
or it silently becomes its own one-row group.

Both maps are lossy on purpose. `spotify_genres` keeps the original strings for
the artist page, and `primary_genre` is the label the UI aggregates on.
"""

from __future__ import annotations

import re
import unicodedata

# The 23 labels in the Kaggle dataset, exactly as spelled there. "Sertanjeo"
# is the dataset's own misspelling of Sertanejo - it is reproduced rather than
# corrected, because it is the string 500 existing rows and every chart group
# already use, and fixing it here would split the genre in two.
CANONICAL_GENRES = (
    "Hip-Hop", "Pop", "Rock", "Reggaeton", "R&B", "Latin", "EDM",
    "Regional Mexican", "K-Pop", "Filmi", "Country", "Alternative",
    "Sertanjeo", "Metal", "Folk", "Soundtrack", "Bachata", "Soul",
    "Reggae", "Afrobeats", "Spoken Word", "Children's Music", "Nu Metal",
)

# Ordered, and the order is load-bearing: the first pattern that matches wins,
# so anything that is a substring of another label has to come first.
#
#   "reggaeton" before "reggae"       - the second is inside the first
#   "nu metal"  before "metal"
#   "k-pop"     before "pop"
#   "regional mexican"/"corrido"/"banda" before "latin"
#
# Patterns are matched against the whole lowercased Spotify genre string with
# re.search, so "atl hip hop" and "canadian hip hop" both reach "Hip-Hop".
_GENRE_RULES: tuple[tuple[str, str], ...] = (
    (r"\bnu[- ]metal\b", "Nu Metal"),
    (r"\bk[- ]?pop\b|\bkorean\b", "K-Pop"),
    (r"\breggaeton\b|\bperreo\b|\bneoperreo\b", "Reggaeton"),
    (r"\bbachata\b", "Bachata"),
    (r"\bsertanejo\b|\bsertanejа\b", "Sertanjeo"),
    (
        r"\bregional mexican\b|\bcorrido\b|\bbanda\b|\bnorte[nñ]o\b|"
        r"\bmariachi\b|\branchera\b|\bgrupera\b|\bm[uú]sica mexicana\b",
        "Regional Mexican",
    ),
    (r"\bfilmi\b|\bbollywood\b|\bdesi\b|\btollywood\b|\bmodern bollywood\b", "Filmi"),
    (r"\bafrobeat", "Afrobeats"),  # afrobeat and afrobeats both
    (r"\bsoundtrack\b|\bshow tunes\b|\bvideo game music\b|\bscore\b", "Soundtrack"),
    (r"\bchildren'?s music\b|\bnursery\b|\bkids\b", "Children's Music"),
    (r"\bspoken word\b|\bpoetry\b|\bcomedy\b", "Spoken Word"),
    (r"\bhip hop\b|\bhip-hop\b|\brap\b|\btrap\b|\bdrill\b|\bgrime\b", "Hip-Hop"),
    (r"\br&b\b|\brnb\b|\brhythm and blues\b", "R&B"),
    (r"\bsoul\b|\bmotown\b|\bfunk\b", "Soul"),
    (r"\breggae\b|\bdancehall\b|\bska\b|\bdub\b", "Reggae"),
    (
        r"\bedm\b|\bhouse\b|\btechno\b|\btrance\b|\bdubstep\b|\bdrum and bass\b|"
        r"\bdnb\b|\belectro\b|\bbig room\b|\bfuture bass\b|\bbrostep\b",
        "EDM",
    ),
    (r"\bcountry\b|\bbluegrass\b|\bnashville\b|\bhonky\b", "Country"),
    (r"\bmetal\b|\bmetalcore\b|\bthrash\b|\bdeathcore\b", "Metal"),
    (r"\bfolk\b|\bsinger-songwriter\b|\bamericana\b|\bbluegrass\b", "Folk"),
    (r"\balternative\b|\bindie\b|\bemo\b|\bpost-punk\b|\bgrunge\b", "Alternative"),
    (r"\brock\b|\bpunk\b|\bpsychedelic\b", "Rock"),
    (
        r"\blatin\b|\burbano\b|\bcumbia\b|\bsalsa\b|\bbolero\b|\btango\b|"
        r"\bmpb\b|\bbrazilian\b|\bfunk carioca\b|\bflamenco\b|\bbachatón\b",
        "Latin",
    ),
    (r"\bpop\b|\bboy band\b|\bgirl group\b", "Pop"),
)

_COMPILED = tuple((re.compile(pattern), label) for pattern, label in _GENRE_RULES)


def canonical_genre(spotify_genres: list[str]) -> str | None:
    """
    The single archive label for a Spotify artist.

    Spotify orders an artist's genres from most to least representative, so
    the first genre that maps to anything wins. Falling through every genre
    without a match returns None rather than guessing - the artist then has
    no primary_genre, is excluded from the genre charts, and is honest about
    it, which beats dumping a Serbian turbo-folk act into "Pop".
    """
    for genre in spotify_genres:
        text = genre.casefold()
        for pattern, label in _COMPILED:
            if pattern.search(text):
                return label
    return None


# ---------------------------------------------------------------- countries --
# MusicBrainz reports ISO 3166-1 alpha-2. The dataset spells countries out, so
# the codes have to be expanded to exactly the strings already in the table -
# "United States", not "USA" or "United States of America", or the country
# filter ends up with two entries for one place.
_COUNTRIES: dict[str, str] = {
    "US": "United States", "GB": "United Kingdom", "CA": "Canada",
    "MX": "Mexico", "CO": "Colombia", "BR": "Brazil", "IN": "India",
    "KR": "South Korea", "AR": "Argentina", "AU": "Australia",
    "DE": "Germany", "ES": "Spain", "FR": "France", "SE": "Sweden",
    "PR": "Puerto Rico", "IT": "Italy", "NL": "Netherlands",
    "JP": "Japan", "IE": "Ireland", "NG": "Nigeria", "JM": "Jamaica",
    "NO": "Norway", "DK": "Denmark", "BE": "Belgium", "NZ": "New Zealand",
    "ZA": "South Africa", "CL": "Chile", "VE": "Venezuela", "PE": "Peru",
    "DO": "Dominican Republic", "CU": "Cuba", "PA": "Panama",
    "UY": "Uruguay", "EC": "Ecuador", "GT": "Guatemala", "CR": "Costa Rica",
    "PT": "Portugal", "PL": "Poland", "RU": "Russia", "UA": "Ukraine",
    "TR": "Turkey", "IL": "Israel", "GR": "Greece", "FI": "Finland",
    "IS": "Iceland", "CH": "Switzerland", "AT": "Austria", "CZ": "Czechia",
    "HU": "Hungary", "RO": "Romania", "CN": "China", "TW": "Taiwan",
    "HK": "Hong Kong", "TH": "Thailand", "PH": "Philippines",
    "ID": "Indonesia", "MY": "Malaysia", "SG": "Singapore",
    "VN": "Vietnam", "PK": "Pakistan", "BD": "Bangladesh",
    "EG": "Egypt", "MA": "Morocco", "DZ": "Algeria", "GH": "Ghana",
    "KE": "Kenya", "TZ": "Tanzania", "SN": "Senegal", "CI": "Ivory Coast",
    "AE": "United Arab Emirates", "SA": "Saudi Arabia", "LB": "Lebanon",
}


def canonical_country(code: str | None) -> str | None:
    """ISO 3166-1 alpha-2 -> the country name the archive already uses."""
    if not code:
        return None
    return _COUNTRIES.get(code.upper())


# -------------------------------------------------------------------- slug --


def slugify(name: str) -> str:
    """
    "Beyonce" -> "beyonce", "Tyler, The Creator" -> "tyler-the-creator".

    Must stay byte-identical to slugify() in scripts/seed.ts: the pipeline
    upserts on `slug`, so a Kaggle row and its Spotify match have to produce
    the same string or the crawl inserts a duplicate artist beside it.
    """
    stripped = "".join(
        ch
        for ch in unicodedata.normalize("NFD", name)
        if not unicodedata.combining(ch)
    )
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-zA-Z0-9]+", "-", stripped)).lower()


def match_key(name: str) -> str:
    """
    A loose key for deciding whether two names are the same artist.

    Accent-, case- and punctuation-insensitive, so the CSV's "Beyonce" lines
    up with Spotify's "Beyoncé" and "Tyler, The Creator" with "Tyler the
    Creator". It is deliberately not fuzzy: it will not equate "P!nk" with
    "Pink", because dropping the punctuation loses the vowel. Those are left
    to Spotify's own search ranking, which is asked for the CSV name verbatim
    and handles stylised spellings well.
    """
    return re.sub(r"[^a-z0-9]", "", slugify(name))
