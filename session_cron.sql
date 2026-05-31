-- Enable pg_cron (run once)
-- SELECT cron.schedule('daily-session-reset', '0 4 * * *', $$
--   DELETE FROM user_sessions WHERE login_at < NOW() - INTERVAL '1 day';
-- $$);

-- Auto-logout at 18:00 Israel time (= 15:00 UTC)
-- SELECT cron.schedule('auto-logout-18', '0 15 * * *', $$
--   UPDATE user_sessions SET logout_at = NOW(), is_active = false
--   WHERE is_active = true AND logout_at IS NULL;
-- $$);

-- Daily cleanup at 06:00 Israel time (= 03:00 UTC) - delete sessions older than today
-- SELECT cron.schedule('daily-cleanup', '0 3 * * *', $$
--   DELETE FROM user_sessions WHERE login_at < date_trunc('day', NOW() AT TIME ZONE 'Asia/Jerusalem' AT TIME ZONE 'UTC');
-- $$);

-- Simple alternative - just delete old sessions daily
SELECT cron.schedule('cleanup-old-sessions', '0 3 * * *', 
  'DELETE FROM user_sessions WHERE login_at < NOW() - INTERVAL ''18 hours''');

SELECT cron.schedule('auto-logout-evening', '0 15 * * *',
  'UPDATE user_sessions SET logout_at = NOW(), is_active = false WHERE is_active = true');
