ALTER TABLE ad_banners ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE ad_banners ADD COLUMN review_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_banners ADD COLUMN reviewed_at TEXT;
ALTER TABLE ad_banners ADD COLUMN reviewed_by TEXT;
UPDATE ad_banners SET approval_status='approved', review_comment='Befintlig banner vid införande av granskning', reviewed_at=COALESCE(published_at, updated_at), reviewed_by='migration-v1';
