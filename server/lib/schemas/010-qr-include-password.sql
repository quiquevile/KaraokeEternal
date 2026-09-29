-- Up
UPDATE rooms
SET data = json_set(
  data,
  '$.prefs.qr.includePassword',
  CASE WHEN json_extract(data, '$.prefs.qr.password') IS NOT NULL THEN 1 ELSE 0 END
);

-- Down
UPDATE rooms SET data = json_remove(data, '$.prefs.qr.includePassword');
