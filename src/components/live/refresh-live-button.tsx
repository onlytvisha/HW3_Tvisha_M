"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Forces a re-fetch of the live profile, past the seven-day cache.
 *
 * Hits the API route with `?refresh=1` to rebuild the cached row, then calls
 * `router.refresh()` so the server components above re-render against the new
 * row. The button owns no profile data itself - it only invalidates.
 */
export function RefreshLiveButton({
  slug,
  fetchedAt,
}: {
  slug: string;
  fetchedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState(false);

  async function refresh() {
    setWorking(true);
    try {
      await fetch(`/api/artists/${slug}/profile?refresh=1`, {
        cache: "no-store",
      });
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setWorking(false);
    }
  }

  const busy = working || pending;

  return (
    <div className="text-sw-text-dim/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <Button
        onClick={() => void refresh()}
        disabled={busy}
        variant="ghost"
        size="sm"
        className="text-sw-text-dim/70 h-auto px-0 text-xs hover:bg-transparent"
      >
        <RefreshCw
          className={`size-3 ${busy ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {busy ? "Refetching" : "Refresh live data"}
      </Button>

      <span>
        Last fetched{" "}
        <time dateTime={fetchedAt} className="tnum">
          {new Date(fetchedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </span>
    </div>
  );
}
