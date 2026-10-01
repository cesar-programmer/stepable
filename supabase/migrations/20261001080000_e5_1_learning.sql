-- Private learning progress: one row per member and published route version,
-- plus every answer attempt. Step states (answered correctly, resolved) and
-- completion are derived from attempts.
create table public.route_progress (
  route_id uuid not null,
  space_id uuid not null,
  profile_id uuid not null references public.profiles (identity_id) on delete restrict,
  -- The published version this progress belongs to (routes are immutable
  -- once published; a future new version will not reuse this progress).
  route_published_at timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (route_id, profile_id),
  constraint route_progress_route_fkey foreign key (route_id, space_id)
    references public.routes (id, space_id) on delete cascade
);

create table public.route_step_attempts (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  profile_id uuid not null,
  step_id uuid not null references public.route_steps (id) on delete cascade,
  attempt_number integer not null,
  selected_option integer not null,
  correct boolean not null,
  submission_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint route_step_attempts_progress_fkey foreign key (route_id, profile_id)
    references public.route_progress (route_id, profile_id) on delete cascade,
  constraint route_step_attempts_number_key unique (step_id, profile_id, attempt_number),
  constraint route_step_attempts_number_range check (attempt_number between 1 and 3),
  constraint route_step_attempts_option_range check (selected_option between 0 and 3)
);

create index route_step_attempts_progress_idx
on public.route_step_attempts (route_id, profile_id);

alter table public.route_progress enable row level security;
alter table public.route_step_attempts enable row level security;
revoke all on table public.route_progress from anon, authenticated;
revoke all on table public.route_step_attempts from anon, authenticated;
