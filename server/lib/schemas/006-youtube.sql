-- Up
ALTER TABLE media ADD COLUMN youtubeVideoId text;
INSERT INTO prefs (key,data) VALUES ('isYouTubeEnabled','false');

-- Down
ALTER TABLE media DROP COLUMN youtubeVideoId;
DELETE FROM prefs WHERE key = 'isYouTubeEnabled';