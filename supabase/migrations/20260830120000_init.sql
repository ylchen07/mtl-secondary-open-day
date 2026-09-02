create type school_language as enum ('fr', 'en', 'bilingual');
create type school_gender as enum ('mixed', 'girls', 'boys');
create type mtl_region as enum (
  'montreal_island', 'west_island', 'laval', 'north_shore', 'south_shore'
);
create type geocode_precision as enum ('exact', 'approximate', 'missing');
create type open_day_type as enum (
  'open_house', 'info_session', 'entrance_exam', 'tour', 'virtual'
);
create type publication_status as enum ('published', 'draft', 'archived');

create table schools (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name_en            text not null check (length(trim(name_en)) > 0),
  name_fr            text not null check (length(trim(name_fr)) > 0),
  language           school_language not null,
  gender             school_gender not null,
  region             mtl_region not null,
  city               text not null,
  address            text not null,
  postal_code        text not null,
  lat                double precision,
  lng                double precision,
  geocode_precision  geocode_precision not null default 'missing',
  website_url        text not null,
  admissions_url     text not null,
  tuition_annual_cad integer check (tuition_annual_cad is null or tuition_annual_cad > 0),
  has_boarding       boolean not null default false,
  programs           text[] not null default '{}',
  description_en     text not null check (length(trim(description_en)) > 0),
  description_fr     text not null check (length(trim(description_fr)) > 0),
  source_url         text not null,
  last_verified_at   date not null,
  status             publication_status not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint location_matches_precision check (
    (geocode_precision = 'missing' and lat is null and lng is null)
    or (geocode_precision <> 'missing' and lat is not null and lng is not null)
  )
);

create table open_days (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  type                  open_day_type not null,
  academic_year         text not null,
  registration_required boolean not null default false,
  registration_url      text,
  notes_en              text,
  notes_fr              text,
  source_url            text not null,
  last_verified_at      date not null,
  status                publication_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint ends_after_starts check (ends_at > starts_at),
  constraint unique_event_per_school unique (school_id, starts_at, type)
);

create index open_days_starts_at_idx on open_days (starts_at);
create index open_days_school_id_idx on open_days (school_id);
create index schools_status_idx on schools (status);

-- Keep updated_at honest
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_updated_at before update on schools
  for each row execute function set_updated_at();
create trigger open_days_updated_at before update on open_days
  for each row execute function set_updated_at();

-- RLS: the browser may read published rows and nothing else.
-- Writes require the service-role key, which bypasses RLS entirely.
alter table schools enable row level security;
alter table open_days enable row level security;

create policy "anon reads published schools" on schools
  for select to anon, authenticated using (status = 'published');

create policy "anon reads published open days" on open_days
  for select to anon, authenticated using (status = 'published');
