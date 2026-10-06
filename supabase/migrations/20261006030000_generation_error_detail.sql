-- Which validation check rejected a generated draft (step number and field
-- names only, never content), so it can be reviewed before another attempt.
alter table public.routes
  add column generation_error_detail text,
  add constraint routes_generation_error_detail_format check (
    generation_error_detail is null
    or generation_error_detail ~ '^[a-z0-9_:,.]{1,120}$'
  );
