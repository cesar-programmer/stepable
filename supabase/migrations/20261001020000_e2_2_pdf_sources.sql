alter table public.source_versions
add column page_count integer,
add constraint source_versions_page_count_range check (
  page_count is null or page_count between 1 and 200
);

alter table public.source_segments
add column page_number integer,
alter column start_line drop not null,
alter column end_line drop not null,
drop constraint source_segments_line_range,
add constraint source_segments_location check (
  (
    page_number is null
    and start_line >= 1
    and end_line >= start_line
  )
  or (
    page_number >= 1
    and start_line is null
    and end_line is null
  )
);
