-- Background workers only touch spaces of their own namespace ("local" for
-- normal use, "pruebas" for automated tests). Existing spaces stay "local".
alter table public.spaces
add column job_namespace text not null default 'local',
add constraint spaces_job_namespace_format check (
  job_namespace ~ '^[a-z0-9_-]{1,32}$'
);
