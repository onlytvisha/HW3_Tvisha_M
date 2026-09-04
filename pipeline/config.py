"""
Shared configuration for the pipeline.

Reads the same `.env.local` the Next.js app uses, so there is one place to put
credentials rather than two that can drift apart.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

# .env.local wins, as it does in Next.js; .env is the fallback.
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# The service-role key when one is set, otherwise the publishable key, which
# schema.sql grants a temporary write policy to. Same order as scripts/seed.ts.
SUPABASE_WRITE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

# MusicBrainz asks every client to identify itself and refuses anonymous
# traffic. This is the contact string it wants; it is not a credential.
MUSICBRAINZ_UA = os.getenv(
    "MUSICBRAINZ_USER_AGENT",
    "NeonArchive/2.0 (student coursework project)",
)

# How many artists the crawl aims for, in total, including the original 500.
TARGET_ARTISTS = int(os.getenv("PIPELINE_TARGET_ARTISTS", "2000"))


class ConfigError(RuntimeError):
    """A missing credential, reported with the fix rather than a traceback."""


def require_supabase() -> tuple[str, str]:
    if not SUPABASE_URL or not SUPABASE_WRITE_KEY:
        raise ConfigError(
            "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.\n"
            "Both live in .env.local - the same two the site already uses."
        )
    return SUPABASE_URL, SUPABASE_WRITE_KEY


def require_spotify() -> tuple[str, str]:
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise ConfigError(
            "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.\n"
            "\n"
            "  1. Sign in at https://developer.spotify.com/dashboard\n"
            "  2. Create an app (any name; redirect URI is unused by this\n"
            "     pipeline, but the form requires one - http://localhost:3000\n"
            "     is fine)\n"
            "  3. Copy the Client ID and Client Secret into .env.local:\n"
            "\n"
            "       SPOTIFY_CLIENT_ID=...\n"
            "       SPOTIFY_CLIENT_SECRET=...\n"
            "\n"
            "The secret is server-side only. It is never read by the Next.js\n"
            "app and must not be given a NEXT_PUBLIC_ prefix."
        )
    return SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET


def die(message: str) -> None:
    print(f"\n{message}\n", file=sys.stderr)
    raise SystemExit(1)
