alter table public.source_versions
add column manual_retries integer not null default 0,
add constraint source_versions_manual_retries_range check (
  manual_retries between 0 and 3
);
