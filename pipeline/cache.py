"""
An on-disk memo for the slow lookup passes.

MusicBrainz is capped at one artist a second and YouTube Music takes about
0.7, so those two passes are twenty to forty minutes of wall clock on a full
run - and both of them finish *before* anything is written to Supabase. A
failure in the write pass therefore threw away the entire lookup, which is
how the first run of this pipeline was spent.

So each lookup is written through to a JSON file under pipeline/.cache/ as
soon as it resolves. A re-run reads what is already there and only asks the
network about names it has never seen, which turns a repeat run from forty
minutes into seconds.

Keyed by artist name rather than slug, because that is what was actually sent
to the API, and it stays valid if a slug ever has to be renumbered for a
collision. Delete the file (or pass --refresh-youtube) to force a re-fetch.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CACHE_DIR = Path(__file__).resolve().parent / ".cache"


class Cache:
    """A dict backed by a JSON file, flushed every `flush_every` writes."""

    def __init__(self, name: str, flush_every: int = 25) -> None:
        self.path = CACHE_DIR / f"{name}.json"
        self.flush_every = flush_every
        self._pending = 0
        self.data: dict[str, Any] = {}

        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                # A half-written file from an interrupted run. Losing the memo
                # costs time, not correctness, so start over rather than stop.
                print(f"  ! {self.path.name} unreadable; starting a fresh cache")
                self.data = {}

    def __contains__(self, key: str) -> bool:
        return key in self.data

    def get(self, key: str) -> Any:
        return self.data.get(key)

    def set(self, key: str, value: Any) -> None:
        self.data[key] = value
        self._pending += 1
        if self._pending >= self.flush_every:
            self.flush()

    def flush(self) -> None:
        if not self._pending:
            return
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # Write beside the target and move into place, so an interrupt cannot
        # leave a truncated file where a valid one used to be.
        temp = self.path.with_suffix(".json.tmp")
        temp.write_text(
            json.dumps(self.data, ensure_ascii=False, indent=0), encoding="utf-8"
        )
        temp.replace(self.path)
        self._pending = 0

    def __len__(self) -> int:
        return len(self.data)
