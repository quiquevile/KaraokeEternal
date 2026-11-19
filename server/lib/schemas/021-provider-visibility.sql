-- Up
UPDATE providers
SET data = json_set(data, '$.visibility', 'public')
WHERE json_extract(data, '$.visibility') IS NULL;

-- Down
UPDATE providers SET data = json_remove(data, '$.visibility');
