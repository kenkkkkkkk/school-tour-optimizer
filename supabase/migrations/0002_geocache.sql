-- Geocoding-cache: sparer os for gentagne Nominatim-kald (1 req/sek limit).
-- Hash-nøglen beregnes i app-laget fra normalize(adresse + postnr) så
-- whitespace og store/små bogstaver ikke giver cache-misser.

create table if not exists public.geocode_cache (
  address_hash text primary key,
  raw_address text not null,
  lat decimal,
  lng decimal,
  /** 'nominatim' | 'failed' — giver os et spor af dårlige adresser */
  source text not null,
  geocoded_at timestamptz not null default now()
);

create index if not exists idx_geocode_cache_geocoded_at on public.geocode_cache(geocoded_at);

-- Afstandsmatrix-cache: OSRM /table giver N×N i ét kald, men vi gemmer
-- par-til-par for at kunne genbruge på tværs af turnéer.
create table if not exists public.distance_cache (
  from_lat decimal not null,
  from_lng decimal not null,
  to_lat decimal not null,
  to_lng decimal not null,
  distance_m integer not null,
  duration_s integer not null,
  cached_at timestamptz not null default now(),
  primary key (from_lat, from_lng, to_lat, to_lng)
);
