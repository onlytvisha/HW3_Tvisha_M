/**
 * GET /api/artists/[slug]/profile
 *
 * The live half of an artist page: the artist's current biggest track and its
 * preview audio, artwork and genre tags from Apple, and a Wikipedia
 * description. The page itself streams this in through Suspense; this route
 * exists so the "refresh live data" control can rebuild the cached row.
 *
 * `?refresh=1` bypasses the cache.
 */
import { NextResponse, type NextRequest } from "next/server";

import { getArtistProfile } from "@/lib/enrich";
import { getArtistBySlug } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const artist = await getArtistBySlug(slug);
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const force = request.nextUrl.searchParams.get("refresh") === "1";
    const profile = await getArtistProfile(artist, force);

    return NextResponse.json(profile, {
      // Cached server-side already; this just lets the browser and the CDN
      // reuse a response for a few minutes without going stale for long.
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error(`profile route failed for "${slug}":`, err);
    return NextResponse.json(
      { error: "Could not load this artist's live profile." },
      { status: 502 },
    );
  }
}
