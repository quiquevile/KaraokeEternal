-- Up
DELETE FROM prefs WHERE key IN ('youtubeDownloadPathId', 'youtubeYtdlDir', 'youtubeDlExtraArgs');
UPDATE users SET permissions = json_remove(permissions, '$.youtubeDownload', '$.downloadForOthers')
WHERE json_extract(permissions, '$.youtubeDownload') IS NOT NULL
   OR json_extract(permissions, '$.downloadForOthers') IS NOT NULL;

-- Down
-- Removed configuration and permissions cannot be recovered.
SELECT 1;
