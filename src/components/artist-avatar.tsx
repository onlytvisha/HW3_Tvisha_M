import { cn } from "@/lib/utils";

/**
 * An artist's portrait, or a deterministic monogram tile when there is none.
 *
 * The pipeline stores a Spotify portrait URL on every artist it matched, so a
 * list page can show real photographs without any outbound API calls - the
 * URLs are already in the row, and the images load lazily from Spotify's CDN.
 * That was not true when this component was written, and the fallback is
 * still what most of the archive shows: an artist Spotify could not match has
 * no image, and neither did any of the 500 before the crawl ran.
 *
 * The fallback is a stable two-colour gradient derived from the name - same
 * artist, same tile, every time - so a page of them looks composed rather
 * than random, and does not shift between renders or between servers.
 */

const PAIRS = [
  ["var(--sw-pink)", "var(--sw-violet)"],
  ["var(--sw-cyan)", "var(--sw-mint)"],
  ["var(--sw-violet)", "var(--sw-cyan)"],
  ["var(--sw-amber)", "var(--sw-pink)"],
  ["var(--sw-mint)", "var(--sw-cyan)"],
  ["var(--sw-pink)", "var(--sw-amber)"],
] as const;

/** Cuts an accent with the card surface, by the current theme's amount. */
function mix(color: string): string {
  return `color-mix(in oklab, ${color} var(--sw-tile-strength), var(--sw-surface))`;
}

/** djb2, so the palette choice is stable across renders and servers. */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return Math.abs(h);
}

/** "Tyler, The Creator" -> "TC", "Drake" -> "DR" */
function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ArtistAvatar({
  name,
  className,
  imageUrl,
}: {
  name: string;
  className?: string;
  /** A real portrait, once one has been fetched. */
  imageUrl?: string | null;
}) {
  const [from, to] = PAIRS[hash(name) % PAIRS.length];

  if (imageUrl) {
    // Remote CDN art (Wikimedia / Apple) of unknown dimensions.
    // next/image would buy little here and costs an optimisation request per
    // artist, so this stays a plain <img>.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "font-heading flex items-center justify-center font-bold tracking-tight text-black/70 select-none",
        className,
      )}
      // Both stops are cut with the card surface by --sw-tile-strength, which
      // is 100% on the neon palette (no change) and a tint on paper, whose
      // accents are too dark to carry black initials at full strength.
      style={{
        backgroundImage: `linear-gradient(135deg, ${mix(from)}, ${mix(to)})`,
      }}
    >
      {monogram(name)}
    </div>
  );
}
