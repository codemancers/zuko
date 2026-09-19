-- Rollback for 20260919120000_clear_bogus_membership_close_times.
-- Nothing to restore: the values cleared were never meaningful, and the
-- timestamps they held cannot be reconstructed.
SELECT 1;
