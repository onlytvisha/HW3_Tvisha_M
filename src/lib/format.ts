/**
 * The dataset stores every stream figure "in millions", so 137492.1 means
 * 137.5 billion plays. Rendering the raw number is unreadable, and rendering
 * it in full ("137,492,100,000") is worse - these helpers keep the scale
 * legible while staying honest about the unit.
 */

/** 137492.1 -> "137.5B". Input is already in millions. */
export function formatStreams(millions: number | null | undefined): string {
  if (millions == null || !Number.isFinite(millions)) return "--";
  // Plain "0", not "0.0M" - the unit is meaningless at the origin, and this
  // is what a chart axis draws for its first tick.
  if (millions === 0) return "0";
  if (millions >= 1_000_000) return `${(millions / 1_000_000).toFixed(1)}T`;
  if (millions >= 1_000) return `${(millions / 1_000).toFixed(1)}B`;
  return `${millions.toFixed(1)}M`;
}

/** The same value written out, for tooltips and `title` attributes. */
export function formatStreamsLong(millions: number | null | undefined): string {
  if (millions == null || !Number.isFinite(millions)) return "unknown";
  return `${millions.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })} million streams`;
}

/** 60123456 -> "60.1M" - for plain counts, as opposed to figures in millions. */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "--";
  return `${n.toFixed(digits)}%`;
}

/** 2006 -> "2000s" */
export function decadeLabel(year: number | null | undefined): string {
  if (year == null) return "Unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

/** Trims a Wikipedia extract to roughly `max` characters on a word boundary. */
export function truncate(text: string, max = 320): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}...`;
}
