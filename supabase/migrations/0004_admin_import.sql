-- Gør lat/lng nullable på hotels så import kan ske i to faser (data → geocoding)
ALTER TABLE hotels ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE hotels ALTER COLUMN lng DROP NOT NULL;
