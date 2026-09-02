"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS = [
  { value: "streams", label: "Most streams" },
  { value: "name", label: "A to Z" },
  { value: "debut", label: "Newest debut" },
  { value: "collab", label: "Most collaborative" },
] as const;

const TYPES = [
  { value: "Solo", label: "Solo" },
  { value: "Group", label: "Group" },
] as const;

/** Sentinel for "no filter" - Radix Select cannot hold an empty string value. */
const ANY = "__any__";

/**
 * Filter controls for the archive.
 *
 * State lives in the URL rather than in React, so a filtered view is
 * shareable and the back button behaves. Every change resets to page 1,
 * because staying on page 7 of a result set that just shrank to two pages is
 * how you get an empty screen.
 */
export function ArchiveFilters({
  genres,
  countries,
}: {
  genres: string[];
  countries: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(urlSearch);

  // Keep the box in step when the URL changes from outside it - the back
  // button, or "clear all" - without fighting the user mid-keystroke.
  // Adjusting during render rather than in an effect avoids a second pass:
  // React re-runs this component immediately with the new value instead of
  // committing the stale one first.
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch);
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch);
    setSearch(urlSearch);
  }

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === ANY) next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");

    startTransition(() => {
      router.push(`/artists?${next.toString()}`, { scroll: false });
    });
  }

  // Debounce typing so a five-letter name is one query, not five.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;

    const timer = setTimeout(() => apply({ q: search }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const genre = params.get("genre") ?? ANY;
  const country = params.get("country") ?? ANY;
  const type = params.get("type") ?? ANY;
  const sort = params.get("sort") ?? "streams";
  const hasFilters =
    genre !== ANY || country !== ANY || type !== ANY || search !== "";

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="relative min-w-[14rem] flex-1">
        <Search
          className="text-sw-text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search 500 artists"
          aria-label="Search artists by name"
          className="bg-sw-surface/60 border-sw-line pl-9"
        />
      </div>

      <Select value={genre} onValueChange={(v) => apply({ genre: v })}>
        <SelectTrigger className="bg-sw-surface/60 border-sw-line w-[10rem]">
          <SelectValue placeholder="Genre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any genre</SelectItem>
          {genres.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={country} onValueChange={(v) => apply({ country: v })}>
        <SelectTrigger className="bg-sw-surface/60 border-sw-line w-[11rem]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any country</SelectItem>
          {countries.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={(v) => apply({ type: v })}>
        <SelectTrigger className="bg-sw-surface/60 border-sw-line w-[8rem]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any type</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => apply({ sort: v })}>
        <SelectTrigger className="bg-sw-surface/60 border-sw-line w-[11rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            startTransition(() => router.push("/artists", { scroll: false }));
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
