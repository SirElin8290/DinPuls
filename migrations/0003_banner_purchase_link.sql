-- Apply once before Worker lazy schema upgrade. Existing rows stay linked to their original contract.
ALTER TABLE ad_banners ADD COLUMN municipality TEXT;
ALTER TABLE ad_banners ADD COLUMN purchase_id TEXT;
