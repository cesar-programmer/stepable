create type public.space_role as enum ('responsable', 'integrante');

create table public.profiles (
  identity_id uuid primary key references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  initial_responsible_id uuid not null references public.profiles (identity_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint spaces_slug_format check (
    char_length(slug) between 3 and 63
    and slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint spaces_name_format check (
    char_length(name) between 1 and 120
    and name = btrim(name)
  )
);

create table public.memberships (
  space_id uuid not null references public.spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (identity_id) on delete restrict,
  role public.space_role not null,
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);

create index memberships_profile_id_idx on public.memberships (profile_id);

create function public.ensure_space_has_responsible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_space_id uuid;
begin
  if tg_table_name = 'spaces' then
    affected_space_id := new.id;
  elsif tg_op = 'DELETE' then
    affected_space_id := old.space_id;
  else
    affected_space_id := new.space_id;
  end if;

  if exists (
    select 1
    from public.spaces
    where id = affected_space_id
  ) and not exists (
    select 1
    from public.memberships
    where space_id = affected_space_id
      and role = 'responsable'
  ) then
    raise check_violation using
      message = 'El espacio debe conservar al menos un responsable.';
  end if;

  return null;
end;
$$;

create constraint trigger spaces_require_responsible
after insert or update on public.spaces
deferrable initially deferred
for each row execute function public.ensure_space_has_responsible();

create constraint trigger memberships_require_responsible
after insert or update or delete on public.memberships
deferrable initially deferred
for each row execute function public.ensure_space_has_responsible();
