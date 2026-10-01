alter type public.access_audit_action add value if not exists 'fuente_cargada';
alter type public.access_audit_action add value if not exists 'fuente_reemplazada';
alter type public.access_audit_action add value if not exists 'procesamiento_reintentado';
alter type public.access_audit_action add value if not exists 'fuente_eliminada';
alter type public.access_audit_target_type add value if not exists 'fuente';

alter table public.sources
add column deleted_at timestamptz,
add column deleted_by uuid references public.profiles (identity_id) on delete restrict,
add column purge_requested_at timestamptz,
add column purged_at timestamptz,
alter column title drop not null,
add constraint sources_title_required check (
  title is not null or status = 'eliminada'
),
add constraint sources_deletion_fields check (
  (status = 'eliminada') = (deleted_at is not null)
),
add constraint sources_purge_fields check (
  purged_at is null or status = 'eliminada'
);

-- Purged versions keep identifiers and states for cleanup and audit, but no
-- content fingerprint.
alter table public.source_versions
alter column sha256 drop not null;

create index sources_pending_purge_idx
on public.sources (purge_requested_at)
where status = 'eliminada' and purged_at is null;
