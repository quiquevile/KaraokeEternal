-- Up
UPDATE rooms SET data = json_remove(data, '$.prefs.qr.password');

-- Down
-- No-op by design: dropped embedded keys cannot be recovered. Room column
-- passwords are unaffected (they are verified, not derived from this).
SELECT 1;
