create type public.invitation_status as enum (
  'pendiente',
  'aceptada',
  'revocada',
  'vencida'
);

create type public.invitation_delivery_status as enum (
  'pendiente',
  'enviada',
  'fallida'
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null,
  role public.space_role not null default 'integrante',
  invited_by uuid not null references public.profiles (identity_id) on delete restrict,
  token_hash text not null unique,
  status public.invitation_status not null default 'pendiente',
  delivery_status public.invitation_delivery_status not null default 'pendiente',
  expires_at timestamptz not null,
  delivered_at timestamptz,
  accepted_by uuid references public.profiles (identity_id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_format check (
    char_length(email) between 3 and 320
    and email = lower(email)
    and email = btrim(email)
    and position('@' in email) > 1
  ),
  constraint invitations_token_hash_format check (
    char_length(token_hash) = 64
    and token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint invitations_expiration_order check (expires_at > created_at),
  constraint invitations_acceptance_fields check (
    (status = 'aceptada' and accepted_by is not null and accepted_at is not null)
    or (status <> 'aceptada' and accepted_by is null and accepted_at is null)
  ),
  constraint invitations_revocation_fields check (
    (status = 'revocada' and revoked_at is not null)
    or (status <> 'revocada' and revoked_at is null)
  )
);

create unique index invitations_one_pending_email_per_space_idx
on public.invitations (space_id, email)
where status = 'pendiente';

create index invitations_space_created_at_idx
on public.invitations (space_id, created_at desc);
