-- RN-40: a responsible can delete a route draft. The generation attempts it
-- used must survive the deletion, or deleting would hand back daily
-- attempts: the attempt keeps its space and loses only the route link.
alter table public.route_generation_attempts
  alter column route_id drop not null;

alter table public.route_generation_attempts
  drop constraint route_generation_attempts_route_id_fkey;

alter table public.route_generation_attempts
  add constraint route_generation_attempts_route_id_fkey
  foreign key (route_id) references public.routes (id) on delete set null;

alter type public.access_audit_action add value if not exists 'borrador_eliminado';
alter type public.access_audit_target_type add value if not exists 'ruta';
