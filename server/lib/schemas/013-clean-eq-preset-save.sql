-- Up
UPDATE users
SET permissions = json_remove(permissions, '$.eqPresetSave')
WHERE json_extract(permissions, '$.eqPresetSave') IS NOT NULL;

-- Down
-- No-op by design: removed flags cannot be recovered.
SELECT 1;
