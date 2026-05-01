-- Fjern raw_address fra geocode_cache — adressen i klartekst er ikke nødvendig
-- da cachen er keyet på hash alene. Eksisterende rækker beholder null-værdien.
ALTER TABLE geocode_cache ALTER COLUMN raw_address DROP NOT NULL;
UPDATE geocode_cache SET raw_address = NULL;
