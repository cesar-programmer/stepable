create extension if not exists vector with schema extensions;

-- Lexical retrieval in Spanish over extracted text.
alter table public.source_segments
add column search_vector tsvector
generated always as (to_tsvector('spanish'::regconfig, content)) stored;

create index source_segments_search_idx
on public.source_segments using gin (search_vector);

-- Semantic retrieval: one vector per segment and embedding model. Rows are
-- removed with their segment, so source purges also remove embeddings.
create table public.source_segment_embeddings (
  version_id uuid not null,
  ordinal integer not null,
  model text not null,
  dimensions integer not null,
  embedding extensions.vector not null,
  created_at timestamptz not null default now(),
  primary key (version_id, ordinal, model),
  constraint source_segment_embeddings_segment_fkey
    foreign key (version_id, ordinal)
    references public.source_segments (version_id, ordinal)
    on delete cascade,
  constraint source_segment_embeddings_model_format check (
    char_length(model) between 1 and 200
  ),
  constraint source_segment_embeddings_dimensions check (
    dimensions between 1 and 4096
    and extensions.vector_dims(embedding) = dimensions
  )
);

alter table public.source_segment_embeddings enable row level security;
revoke all on table public.source_segment_embeddings from anon, authenticated;
