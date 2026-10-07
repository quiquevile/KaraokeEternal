-- Up
ALTER TABLE users ADD COLUMN data JSON DEFAULT '{}';
UPDATE users SET data = '{}' WHERE data IS NULL;

-- global EQ presets are now per-user (unattributable); drop the shared row
DELETE FROM prefs WHERE key = 'eqPresets';

-- Down
ALTER TABLE users DROP COLUMN data;
