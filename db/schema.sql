create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  email text,
  role text not null default 'Owner',
  invited_at timestamptz,
  accepted_at timestamptz,
  account_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  password_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_email
  on accounts (lower(email));

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sign_in_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists seats_organization_email
  on seats (organization_id, lower(email))
  where email is not null;

create table if not exists shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  performed_on date not null,
  published_at timestamptz,
  published_snapshot jsonb,
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
  mix jsonb,
  stage jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
