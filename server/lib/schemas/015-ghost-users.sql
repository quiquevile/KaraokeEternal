-- Up
INSERT INTO roles (name) VALUES ('ghost');

ALTER TABLE users ADD COLUMN createdBy integer REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED;

-- Down
UPDATE users SET createdBy = NULL WHERE createdBy IS NOT NULL;
ALTER TABLE users DROP COLUMN createdBy;
DELETE FROM roles WHERE name = 'ghost';
