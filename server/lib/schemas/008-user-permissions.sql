-- Up
ALTER TABLE users ADD COLUMN permissions JSON DEFAULT '{}';
UPDATE users SET permissions = '{}' WHERE permissions IS NULL;

-- Down
ALTER TABLE users DROP COLUMN permissions;
