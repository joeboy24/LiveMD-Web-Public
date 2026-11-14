create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references shows (id),
  title text not null,
  tempo double precision not null,
  beats_per_bar integer not null,
  key text,
  lead_beats double precision not null default 0,
  slip_bars integer not null default 0,
  lyrics text not null default '',
  sections jsonb not null default '[]'::jsonb,
  cues jsonb not null default '[]'::jsonb,
  stem_key text,
  guide_key text,
  track_keys jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
