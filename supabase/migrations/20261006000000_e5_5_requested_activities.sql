-- E5.5: activity types the responsible requested for a generated draft.
-- Existing routes get the previous behavior's default, multiple choice.
alter table public.routes
  add column requested_activities text[] not null
    default array['opcion_multiple']::text[],
  add constraint routes_requested_activities check (
    cardinality(requested_activities) between 1 and 3
    and requested_activities
      <@ array['opcion_multiple', 'lectura_codigo', 'completar']::text[]
  );
