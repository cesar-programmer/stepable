alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.access_audit_events enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.spaces from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.invitations from anon, authenticated;
revoke all on table public.access_audit_events from anon, authenticated;
