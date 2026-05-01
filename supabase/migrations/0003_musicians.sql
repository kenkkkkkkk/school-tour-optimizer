CREATE TABLE musicians (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  band_name       TEXT             NOT NULL,
  production_name TEXT             NOT NULL,
  first_name      TEXT             NOT NULL DEFAULT '',
  last_name       TEXT             NOT NULL DEFAULT '',
  address         TEXT             NOT NULL DEFAULT '',
  postal_code     TEXT             NOT NULL DEFAULT '',
  city            TEXT             NOT NULL DEFAULT '',
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  created_at      TIMESTAMPTZ      DEFAULT NOW()
);

-- Unikt indeks på identitet — gør upsert idempotent
CREATE UNIQUE INDEX musicians_identity_idx
  ON musicians (band_name, production_name, first_name, last_name);
