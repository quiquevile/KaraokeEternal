-- Up
CREATE TABLE IF NOT EXISTS "songFlaws" (
  "userId" integer NOT NULL REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED,
  "songId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idxUserSongFlaw ON "songFlaws" ("userId" ASC, "songId" ASC);

-- Down
DROP TABLE IF EXISTS "songFlaws";
