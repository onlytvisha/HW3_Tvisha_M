-- Run this in the Supabase SQL Editor once "npm run seed" has loaded the 500
-- rows into public.artists.
--
-- schema.sql grants the publishable key write access to that table so the seed
-- script can run without a service-role secret. Nothing after seeding needs it:
-- the app only ever reads the dataset, and the one table it writes at runtime
-- (artist_profiles) keeps its own policies.
--
-- To re-seed later, re-run the "Seed write artists" policy from schema.sql.

drop policy if exists "Seed write artists" on public.artists;

-- Verify: this should return one row, the read policy.
select policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'artists';
