-- Retire the blogroll capability removed in 0.15.
--
-- The discovery service (Zevprobe) was retired: the blogs it surfaced were not
-- worth the daily pipeline. Instances that ran `0003_discovered_blogs.sql` get
-- the leftovers dropped here; `0003` is gone from the template, so new
-- instances never create them.
--
-- `/blogroll`, `scripts/blogs-sync.mjs` and `repositories/blogs.ts` were deleted
-- in the same release — no code reads these tables any more.

DROP TABLE IF EXISTS discovered_picks;
DROP TABLE IF EXISTS discovered_blogs;
DROP TABLE IF EXISTS sync_state;
