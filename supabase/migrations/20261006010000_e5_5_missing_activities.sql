-- E5.5: requested activity types a generated draft lacked, recorded with the
-- "tipos_no_cubiertos" failure. Null when not applicable or not recorded
-- (failures before this change).
alter table public.routes
  add column generation_missing_activities text[],
  add constraint routes_generation_missing_activities check (
    generation_missing_activities is null
    or generation_missing_activities
      <@ array['opcion_multiple', 'lectura_codigo', 'completar']::text[]
  );
