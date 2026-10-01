create type public.route_status as enum ('borrador', 'publicada');

create type public.route_generation_status as enum (
  'en_cola',
  'generando',
  'lista',
  'insuficiente',
  'fallida'
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  objective text not null,
  title text,
  status public.route_status not null default 'borrador',
  generation_status public.route_generation_status not null default 'en_cola',
  generation_error text,
  generation_token uuid not null,
  generation_started_at timestamptz,
  edit_version integer not null default 0,
  created_by uuid not null references public.profiles (identity_id) on delete restrict,
  published_by uuid references public.profiles (identity_id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_id_space_key unique (id, space_id),
  constraint routes_objective_length check (
    char_length(objective) between 10 and 500
  ),
  constraint routes_title_length check (
    title is null or char_length(title) between 1 and 120
  ),
  constraint routes_generation_error_format check (
    generation_error is null or generation_error ~ '^[a-z_]{1,64}$'
  ),
  constraint routes_publication_fields check (
    (status = 'publicada') = (published_at is not null and published_by is not null)
  ),
  constraint routes_published_ready check (
    status <> 'publicada' or (generation_status = 'lista' and title is not null)
  )
);

create index routes_space_created_at_idx
on public.routes (space_id, created_at desc);

create table public.route_sources (
  route_id uuid not null,
  space_id uuid not null,
  source_id uuid not null,
  primary key (route_id, source_id),
  constraint route_sources_route_fkey foreign key (route_id, space_id)
    references public.routes (id, space_id) on delete cascade,
  constraint route_sources_source_fkey foreign key (source_id, space_id)
    references public.sources (id, space_id) on delete cascade
);

create table public.route_steps (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  position integer not null,
  title text not null,
  lesson text not null,
  question text not null,
  options text[] not null,
  correct_option integer not null,
  explanation text not null,
  constraint route_steps_position_key unique (route_id, position)
    deferrable initially deferred,
  constraint route_steps_position_range check (position between 1 and 7),
  constraint route_steps_text_lengths check (
    char_length(title) between 1 and 120
    and char_length(lesson) between 1 and 2000
    and char_length(question) between 1 and 400
    and char_length(explanation) between 1 and 800
  ),
  constraint route_steps_options check (
    cardinality(options) between 3 and 4
    and correct_option >= 0
    and correct_option < cardinality(options)
  )
);

-- Citations keep a snapshot (title, version number, location) so a published
-- route stays stable; whether the cited version is still current is computed
-- when reading, never copied into the route.
create table public.route_citations (
  step_id uuid not null references public.route_steps (id) on delete cascade,
  ref integer not null,
  space_id uuid not null,
  source_id uuid not null,
  version_id uuid not null references public.source_versions (id) on delete cascade,
  version_number integer not null,
  source_title text not null,
  location text not null,
  primary key (step_id, ref),
  constraint route_citations_ref_range check (ref between 1 and 50),
  constraint route_citations_source_fkey foreign key (source_id, space_id)
    references public.sources (id, space_id) on delete cascade
);

-- A row is written right before each provider call, so the daily limit
-- counts regenerations and failures that reached the provider.
create table public.route_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index route_generation_attempts_space_idx
on public.route_generation_attempts (space_id, attempted_at);

alter table public.routes enable row level security;
alter table public.route_sources enable row level security;
alter table public.route_steps enable row level security;
alter table public.route_citations enable row level security;
alter table public.route_generation_attempts enable row level security;

revoke all on table public.routes from anon, authenticated;
revoke all on table public.route_sources from anon, authenticated;
revoke all on table public.route_steps from anon, authenticated;
revoke all on table public.route_citations from anon, authenticated;
revoke all on table public.route_generation_attempts from anon, authenticated;
