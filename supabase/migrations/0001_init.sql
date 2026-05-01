-- LMS Turnéplanner — initial skema
-- Ingen auth i MVP, så RLS er deaktiveret. Skal slås til før deployment.

-- ──────────────────────────────────────────────────────────────
-- Turnéer
-- ──────────────────────────────────────────────────────────────
create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  band_name text not null,
  home_base_lat decimal,
  home_base_lng decimal,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- Koncert-stops (spillesteder på en given turné)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.concert_stops (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  school_name text not null,
  address text not null,
  postal_code text not null,
  city text not null,
  municipality text not null,
  area text not null,
  concert_date date not null,
  concert_time time not null,
  is_evening_concert boolean not null default false,
  notes text not null default '',
  lat decimal,
  lng decimal,
  day_order integer not null default 0,
  tour_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_concert_stops_tour_id on public.concert_stops(tour_id);
create index if not exists idx_concert_stops_date on public.concert_stops(concert_date);

-- ──────────────────────────────────────────────────────────────
-- Hoteller (stamdata — importeres fra Excel én gang)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  postal_code text not null,
  city text not null,
  municipality text not null,
  area text not null,
  has_agreement boolean not null default false,
  single_room_price integer,
  double_room_price integer,
  checkin_after time,
  checkout_before time,
  breakfast_included boolean not null default false,
  parking text,
  notes text not null default '',
  is_active boolean not null default true,
  lat decimal not null,
  lng decimal not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hotels_area on public.hotels(area) where is_active = true;

-- ──────────────────────────────────────────────────────────────
-- Valgte hoteller pr. turné-nat
-- ──────────────────────────────────────────────────────────────
create table if not exists public.tour_hotels (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id),
  night_date date not null,
  is_suggested boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tour_id, night_date)
);

create index if not exists idx_tour_hotels_tour_id on public.tour_hotels(tour_id);

-- ──────────────────────────────────────────────────────────────
-- updated_at trigger
-- ──────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tours_set_updated_at on public.tours;
create trigger tours_set_updated_at
  before update on public.tours
  for each row execute function public.set_updated_at();
