create type public.source_status as enum ('activa', 'eliminada');

create type public.source_format as enum ('markdown', 'pdf');

create type public.source_version_status as enum (
  'en_cola',
  'procesando',
  'lista',
  'fallida',
  'reemplazada',
  'descartada'
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null,
  status public.source_status not null default 'activa',
  current_version_id uuid,
  created_by uuid not null references public.profiles (identity_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_id_space_key unique (id, space_id),
  constraint sources_title_format check (
    char_length(title) between 1 and 120
    and title = btrim(title)
  )
);

create index sources_space_created_at_idx
on public.sources (space_id, created_at desc);

create table public.source_versions (
  id uuid primary key,
  source_id uuid not null,
  space_id uuid not null,
  number integer not null,
  format public.source_format not null,
  byte_size integer not null,
  sha256 text not null,
  storage_key text not null unique,
  status public.source_version_status not null default 'en_cola',
  error_code text,
  section_count integer,
  attempts integer not null default 0,
  created_by uuid not null references public.profiles (identity_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint source_versions_source_fkey
    foreign key (source_id, space_id)
    references public.sources (id, space_id)
    on delete cascade,
  constraint source_versions_id_source_key unique (id, source_id),
  constraint source_versions_number_key unique (source_id, number),
  constraint source_versions_number_positive check (number > 0),
  constraint source_versions_byte_size_positive check (byte_size > 0),
  constraint source_versions_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint source_versions_error_code_format check (
    error_code is null or error_code ~ '^[a-z_]{1,64}$'
  ),
  constraint source_versions_ready_fields check (
    (status = 'lista' and section_count is not null and processed_at is not null)
    or status <> 'lista'
  ),
  constraint source_versions_failure_fields check (
    (status = 'fallida' and error_code is not null)
    or (status <> 'fallida' and error_code is null)
  )
);

create unique index source_versions_one_in_progress_idx
on public.source_versions (source_id)
where status in ('en_cola', 'procesando');

create index source_versions_status_updated_at_idx
on public.source_versions (status, updated_at);

alter table public.sources
add constraint sources_current_version_fkey
foreign key (current_version_id, id)
references public.source_versions (id, source_id);

create table public.source_segments (
  version_id uuid not null references public.source_versions (id) on delete cascade,
  ordinal integer not null,
  heading_path text[] not null default '{}',
  start_line integer not null,
  end_line integer not null,
  content text not null,
  primary key (version_id, ordinal),
  constraint source_segments_ordinal_positive check (ordinal >= 0),
  constraint source_segments_line_range check (
    start_line >= 1 and end_line >= start_line
  )
);

alter table public.sources enable row level security;
alter table public.source_versions enable row level security;
alter table public.source_segments enable row level security;

revoke all on table public.sources from anon, authenticated;
revoke all on table public.source_versions from anon, authenticated;
revoke all on table public.source_segments from anon, authenticated;

revoke all on schema pgboss from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fuentes',
  'fuentes',
  false,
  8388608,
  array['text/markdown', 'application/pdf']
)
on conflict (id) do nothing;
