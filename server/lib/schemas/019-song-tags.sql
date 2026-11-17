-- Up
CREATE TABLE tags (
  tagId integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL COLLATE NOCASE,
  visibility text NOT NULL CHECK (visibility IN ('public', 'admin', 'manager'))
);
CREATE UNIQUE INDEX idxTagName ON tags (name COLLATE NOCASE);

CREATE TABLE songTags (
  songId integer NOT NULL REFERENCES songs(songId) ON DELETE CASCADE,
  tagId integer NOT NULL REFERENCES tags(tagId) ON DELETE CASCADE,
  PRIMARY KEY (songId, tagId)
);
CREATE INDEX idxSongTagsTag ON songTags (tagId, songId);

INSERT INTO tags (name, visibility)
SELECT 'error', 'admin' WHERE EXISTS (
  SELECT 1 FROM songFlaws JOIN songs ON songs.songId = songFlaws.songId
);
INSERT INTO songTags (songId, tagId)
SELECT DISTINCT songFlaws.songId, tags.tagId
FROM songFlaws CROSS JOIN tags
INNER JOIN songs ON songs.songId = songFlaws.songId
WHERE tags.name = 'error';
DROP TABLE songFlaws;
UPDATE users SET permissions = json_remove(permissions, '$.songFlaws')
WHERE json_extract(permissions, '$.songFlaws') IS NOT NULL;

-- Down
CREATE TABLE songFlaws (
  userId integer NOT NULL REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED,
  songId integer NOT NULL
);
CREATE UNIQUE INDEX idxUserSongFlaw ON songFlaws (userId, songId);
DROP TABLE songTags;
DROP TABLE tags;
