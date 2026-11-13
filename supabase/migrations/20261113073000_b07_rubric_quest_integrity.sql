-- B07: Prevent private rubrics from referring to unknown
-- quest items or learning objectives.

create or replace function public.b07_guard_private_rubric()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_public jsonb;
  v_items jsonb;
  v_item jsonb;
  v_item_id text;
  v_objective_id text;
  v_seen text[] := array[]::text[];
  v_step_count integer;
  v_distinct_step_count integer;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Private rubric versions are immutable'
      using errcode = '42501';
  end if;

  select p.public_payload
  into v_public
  from public.published_quest_versions p
  where p.quest_version_id = new.quest_version_id
    and p.approved_by = new.registered_by;

  if not found then
    raise exception 'Rubric registration is not authorized'
      using errcode = '42501';
  end if;

  v_items := new.private_spec -> 'items';

  if coalesce(jsonb_typeof(v_items), '') <> 'array'
    or jsonb_array_length(v_items) = 0
    or coalesce(jsonb_typeof(v_public -> 'steps'), '') <> 'array'
    or coalesce(jsonb_typeof(v_public -> 'objective_ids'), '') <> 'array'
  then
    raise exception 'Invalid assessment specification'
      using errcode = '22023';
  end if;

  select count(*), count(distinct s.value ->> 'item_id')
  into v_step_count, v_distinct_step_count
  from jsonb_array_elements(v_public -> 'steps') s(value)
  where s.value ->> 'type' = 'select_evidence';

  if v_step_count = 0
    or v_step_count <> v_distinct_step_count
    or jsonb_array_length(v_items) <> v_step_count
  then
    raise exception 'Rubric items do not match published quest'
      using errcode = '22023';
  end if;

  for v_item in
    select x.value from jsonb_array_elements(v_items) x(value)
  loop
    v_item_id := v_item ->> 'item_id';
    v_objective_id := v_item ->> 'objective_id';

    if coalesce(length(v_item_id), 0) = 0
      or coalesce(length(v_objective_id), 0) = 0
      or v_item_id = any(v_seen)
      or not (v_public -> 'objective_ids' ? v_objective_id)
      or coalesce(jsonb_typeof(v_item -> 'max_points'), '') <> 'number'
    then
      raise exception 'Invalid rubric item or objective'
        using errcode = '22023';
    end if;

    if (v_item ->> 'max_points')::numeric <= 0
      or (v_item ->> 'max_points')::numeric > 10000
    then
      raise exception 'Invalid rubric maximum points'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(v_public -> 'steps') s(value)
      where s.value ->> 'type' = 'select_evidence'
        and s.value ->> 'item_id' = v_item_id
    ) then
      raise exception 'Rubric item not found in published quest'
        using errcode = '22023';
    end if;

    v_seen := array_append(v_seen, v_item_id);
  end loop;

  return new;
end;
$$;