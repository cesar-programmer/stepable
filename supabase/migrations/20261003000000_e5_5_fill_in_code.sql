-- E5.5: "completar" steps have a single [[hueco]] in their code and a list of
-- accepted answers (the first one is the main answer). Existing steps keep the
-- default 'opcion_multiple' and are not rewritten.
alter table public.route_steps
  add column activity_type text not null default 'opcion_multiple',
  add column accepted_answers text[];

alter table public.route_steps alter column correct_option drop not null;
alter table public.route_steps drop constraint route_steps_options;

alter table public.route_steps
  add constraint route_steps_activity check (
    (
      activity_type = 'opcion_multiple'
      and accepted_answers is null
      and correct_option is not null
      and cardinality(options) between 3 and 4
      and correct_option >= 0
      and correct_option < cardinality(options)
    )
    or (
      activity_type = 'completar'
      and cardinality(options) = 0
      and correct_option is null
      and cardinality(accepted_answers) between 1 and 5
      and code is not null
      -- exactly one hole marker ("[[hueco]]" has 9 characters)
      and char_length(code) - char_length(replace(code, '[[hueco]]', '')) = 9
    )
  );

-- An attempt stores either the chosen option or the written answer.
alter table public.route_step_attempts alter column selected_option drop not null;
alter table public.route_step_attempts
  add column answer_text text,
  add constraint route_step_attempts_response check (
    (selected_option is not null and answer_text is null)
    or (
      selected_option is null
      and answer_text is not null
      and char_length(answer_text) between 1 and 200
    )
  );
