create type public.access_audit_action as enum (
  'espacio_creado',
  'invitacion_creada',
  'invitacion_reenviada',
  'invitacion_cancelada',
  'invitacion_aceptada',
  'rol_membresia_cambiado',
  'membresia_retirada',
  'membresia_abandonada'
);

create type public.access_audit_actor_type as enum ('identidad', 'operador');

create type public.access_audit_target_type as enum (
  'espacio',
  'invitacion',
  'membresia'
);

create table public.access_audit_events (
  id uuid primary key default gen_random_uuid(),
  action public.access_audit_action not null,
  actor_type public.access_audit_actor_type not null,
  actor_profile_id uuid references public.profiles (identity_id) on delete restrict,
  space_id uuid not null references public.spaces (id) on delete cascade,
  target_type public.access_audit_target_type not null,
  target_id uuid not null,
  occurred_at timestamptz not null default now(),
  constraint access_audit_actor_fields check (
    (actor_type = 'identidad' and actor_profile_id is not null)
    or (actor_type = 'operador' and actor_profile_id is null)
  )
);

create index access_audit_events_space_occurred_at_idx
on public.access_audit_events (space_id, occurred_at desc);

create index access_audit_events_actor_occurred_at_idx
on public.access_audit_events (actor_profile_id, occurred_at desc)
where actor_profile_id is not null;
