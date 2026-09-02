import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local locally, or set them in the Vercel " +
      "project's Environment Variables.",
  );
}

/**
 * Read-only client. RLS grants the anon key `select` on `artists` and
 * `artist_profiles` and nothing else, so this is safe to reach for anywhere.
 */
export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

/**
 * Service-role client, for the one thing the anon key cannot do: write the
 * `artist_profiles` cache after a live lookup. Returns null when the key is
 * absent so the app degrades to "fetch every time" rather than crashing -
 * which is exactly what happens on a preview deploy without the secret set.
 *
 * Never import this from a Client Component.
 */
export function getServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  return createClient(url!, serviceKey, { auth: { persistSession: false } });
}
