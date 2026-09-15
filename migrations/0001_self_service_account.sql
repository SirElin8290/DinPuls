-- Forward-only D1 migration for existing business_users. Do not reset or delete any customers.
-- The Worker also checks PRAGMA table_info and applies missing columns on startup,
-- matching the repository's established schema-upgrade routine.
ALTER TABLE business_users ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE business_users ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE business_users ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE business_users ADD COLUMN registration_source TEXT NOT NULL DEFAULT 'admin';
CREATE UNIQUE INDEX IF NOT EXISTS business_users_self_service_org
  ON business_users(org_no) WHERE registration_source = 'self-service';
