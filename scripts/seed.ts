/**
 * Loads data/spotify_artists.csv into public.artists.
 *
 *   npm run seed
 *
 * Idempotent: upserts on `slug`, so re-running after a schema tweak is safe.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY when one is configured. Without it, it falls
 * back to the publishable key, which schema.sql grants temporary write access
 * to this one table - run supabase/lock-artists.sql afterwards to take that
 * back.
 */
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const CSV_PATH = resolve(process.cwd(), "data/spotify_artists.csv");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const writeKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !writeKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, or both SUPABASE_SERVICE_ROLE_KEY and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Copy .env.example to .env.local and fill them in " +
      "(Supabase -> Project Settings -> API).",
  );
  process.exit(1);
}

console.log(
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "Writing with the service-role key."
    : 'Writing with the publishable key (needs the "Seed write artists" ' +
        "policy from schema.sql).",
);

/** "Beyoncé" -> "beyonce", "Tyler, The Creator" -> "tyler-the-creator" */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip accents: Beyonce not Beyoncé
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function num(value: string): number | null {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

type Row = Record<string, string>;

const rows: Row[] = parse(readFileSync(CSV_PATH, "utf8"), {
  columns: (header: string[]) => header.map((h) => h.trim()), // CSV has " Artist Type"
  skip_empty_lines: true,
  trim: true,
});

console.log(`Read ${rows.length} rows from ${CSV_PATH}`);

// Rank by lifetime streams so the UI can show "#1 of 500" without sorting.
const ranked = [...rows].sort(
  (a, b) =>
    (num(b["Total Streams (in millions)"]) ?? 0) -
    (num(a["Total Streams (in millions)"]) ?? 0),
);
const seen = new Map<string, number>();
const records = ranked.map((row, i) => {
  const name = row["Artist Name"];

  // Two artists could slugify identically ("P!nk" / "Pink"); keep slugs unique
  // so they stay usable as the primary key of a URL.
  let slug = slugify(name);
  const hits = seen.get(slug) ?? 0;
  seen.set(slug, hits + 1);
  if (hits > 0) slug = `${slug}-${hits + 1}`;

  return {
    slug,
    name,
    sex: row["Sex"] || null,
    country: row["Country of Origin"] || null,
    language: row["Primary Language"] || null,
    primary_genre: row["Primary Genre"] || null,
    artist_type: row["Artist Type"] || null,
    debut_year: num(row["Debut Year"]),
    total_streams_m: num(row["Total Streams (in millions)"]),
    lead_streams_m: num(row["Lead Streams (in millions)"]),
    feature_streams_m: num(row["Feature Streams (in millions)"]),
    solo_streams_m: num(row["Solo Streams (in millions)"]),
    solo_pct: num(row["% of Solo Streams"]),
    collab_streams_m: num(row["Collaborative Streams (in millions)"]),
    collab_pct: num(row["% of Collaborative Streams"]),
    stream_rank: i + 1,
  };
});

const supabase = createClient(url, writeKey, {
  auth: { persistSession: false },
});

// Wrapped rather than top-level await: the project has no "type": "module",
// so tsx compiles this to CommonJS, where top-level await is a syntax error.
async function main() {
  const CHUNK = 100;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("artists")
      .upsert(chunk, { onConflict: "slug" });

    if (error) {
      console.error(`Failed at rows ${i}-${i + chunk.length}:`, error.message);
      process.exit(1);
    }
    console.log(
      `  upserted ${Math.min(i + CHUNK, records.length)}/${records.length}`,
    );
  }

  const { count } = await supabase
    .from("artists")
    .select("*", { count: "exact", head: true });

  console.log(`Done. public.artists now holds ${count} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
