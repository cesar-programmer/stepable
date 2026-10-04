-- E5.4: optional read-only code snippet per step. Existing steps (drafts and
-- published routes) keep null and are not rewritten. The snippet is stored as
-- plain text; it is never executed or rendered as HTML.
alter table public.route_steps
  add column code text,
  add column code_language text,
  add column code_origin text;

alter table public.route_steps
  add constraint route_steps_code check (
    (code is null and code_language is null and code_origin is null)
    or (
      code is not null
      and char_length(code) between 1 and 3000
      and code_origin in ('fuente', 'ilustrativo')
      and (code_language is null or code_language ~ '^[a-z0-9+#._-]{1,30}$')
    )
  );
