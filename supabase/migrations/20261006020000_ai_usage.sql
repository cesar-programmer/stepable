-- RF-10: estimated AI consumption control. Budgets are per job namespace
-- ("local" for the prototype, "pruebas" for automated tests), so tests never
-- touch the prototype's figures. Rows hold no questions, answers, documents
-- or keys: only who/what/when, token counts and estimated cost.
create table public.ai_budgets (
  namespace text primary key check (namespace ~ '^[a-z0-9_-]{1,32}$'),
  -- Consumption is registered from this moment; it is not total spend.
  started_at timestamptz not null default now()
);

insert into public.ai_budgets (namespace) values ('local');

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  namespace text not null references public.ai_budgets (namespace),
  feature text not null
    check (feature in ('asistente', 'ayuda', 'generacion', 'indexacion')),
  kind text not null check (kind in ('conversacion', 'embeddings')),
  -- No foreign keys: the global budget must keep counting after a space or
  -- a profile is deleted.
  space_id uuid,
  profile_id uuid,
  pricing_key text not null check (char_length(pricing_key) between 1 and 120),
  status text not null
    check (status in ('reservada', 'completada', 'incierta', 'liberada')),
  -- Micro-dollars (1e-6 USD), estimated from configured rates.
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  cost_micro_usd bigint not null check (cost_micro_usd >= 0),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index ai_usage_namespace_created_idx
on public.ai_usage (namespace, created_at);
create index ai_usage_space_created_idx
on public.ai_usage (namespace, space_id, created_at);
create index ai_usage_profile_created_idx
on public.ai_usage (namespace, profile_id, created_at);

alter table public.ai_budgets enable row level security;
alter table public.ai_usage enable row level security;
revoke all on table public.ai_budgets from anon, authenticated;
revoke all on table public.ai_usage from anon, authenticated;
