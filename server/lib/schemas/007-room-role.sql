-- Up
INSERT INTO roles (name) VALUES ('roomadmin');

-- Down
DELETE FROM roles WHERE name = 'roomadmin';
