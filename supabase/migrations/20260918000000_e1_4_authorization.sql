create type public.membership_status as enum ('activa', 'revocada');

alter table public.memberships
add column status public.membership_status not null default 'activa';

create or replace function public.ensure_space_has_responsible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_space_id uuid;
begin
  if tg_table_name = 'spaces' then
    affected_space_id := new.id;
  elsif tg_op = 'DELETE' then
    affected_space_id := old.space_id;
  else
    affected_space_id := new.space_id;
  end if;

  if exists (
    select 1
    from public.spaces
    where id = affected_space_id
  ) and not exists (
    select 1
    from public.memberships
    where space_id = affected_space_id
      and role = 'responsable'
      and status = 'activa'
  ) then
    raise check_violation using
      message = 'El espacio debe conservar al menos un responsable activo.';
  end if;

  return null;
end;
$$;
