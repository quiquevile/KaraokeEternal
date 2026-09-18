-- Up
ALTER TABLE media ADD COLUMN youtubeVideoId text;

-- Down
ALTER TABLE media DROP COLUMN youtubeVideoId;