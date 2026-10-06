-- Field names in the detail are camelCase (for example "correctOption").
alter table public.routes
  drop constraint routes_generation_error_detail_format,
  add constraint routes_generation_error_detail_format check (
    generation_error_detail is null
    or generation_error_detail ~ '^[A-Za-z0-9_:,.]{1,120}$'
  );
