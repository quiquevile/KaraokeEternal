-- Up
UPDATE users
SET roleId = (SELECT roleId FROM roles WHERE name = 'standard'),
    permissions = '{"queueDelete":true,"queueMove":true,"queueReplay":true,"playerAccess":true,"playerControls":true}'
WHERE roleId = (SELECT roleId FROM roles WHERE name = 'roomadmin');

-- Down
UPDATE users
SET roleId = (SELECT roleId FROM roles WHERE name = 'roomadmin'),
    permissions = '{}'
WHERE roleId = (SELECT roleId FROM roles WHERE name = 'standard')
  AND permissions = '{"queueDelete":true,"queueMove":true,"queueReplay":true,"playerAccess":true,"playerControls":true}';
