-- Iteration 3 – audit rows of one transaction share their time.
-- Since quote lines get increasing created_at values (clock_timestamp, for
-- their order), inserted records were audited at slightly different times.
-- The History groups one save by its transaction time, so a user's inserts
-- are now audited at now(), like updates and deletes.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ignored constant text[] := array['created_at', 'updated_at', 'created_by', 'updated_by'];
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity_id uuid;
  v_case_id uuid;
  v_actor_id uuid := auth.uid();
  v_actor public.actor_type;
  v_field text;
begin
  -- Join tables have no id: damaged_part uses its damage, case_tag its case.
  v_entity_id := coalesce(
    (v_row ->> 'id')::uuid,
    (v_row ->> 'damage_id')::uuid,
    (v_row ->> 'case_id')::uuid
  );

  v_case_id := case tg_table_name
    when 'case' then (v_row ->> 'id')::uuid
    when 'vehicle' then null
    when 'damaged_part' then
      (select d.case_id from public.damage d where d.id = (v_row ->> 'damage_id')::uuid)
    when 'quote_line' then
      (select q.case_id from public.quote q where q.id = (v_row ->> 'quote_id')::uuid)
    else (v_row ->> 'case_id')::uuid
  end;
  if v_case_id is not null and not exists (select 1 from public."case" c where c.id = v_case_id) then
    v_case_id := null;
  end if;

  if current_setting('app.actor_type', true) = 'system' then
    -- Automatic changes (BR-03).
    v_actor := 'system';
    v_actor_id := null;
  elsif v_actor_id is not null then
    v_actor := 'user';
  elsif tg_op = 'INSERT' and v_new ->> 'created_by' is not null then
    -- Service-role inserts on behalf of a user (seed data).
    v_actor := 'user';
    v_actor_id := (v_new ->> 'created_by')::uuid;
  else
    v_actor := 'system';
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_log (entity, entity_id, case_id, field, old_value, new_value, actor_type, actor_id, at)
    values (
      tg_table_name, v_entity_id, v_case_id, null, null, (v_new - v_ignored)::text, v_actor, v_actor_id,
      -- A user's changes in one transaction share its time, so one save is one
      -- History entry; service-role inserts (seed data) keep their created_at.
      case when auth.uid() is not null then now() else coalesce((v_new ->> 'created_at')::timestamptz, now()) end
    );
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (entity, entity_id, case_id, field, old_value, new_value, actor_type, actor_id, at)
    values (tg_table_name, v_entity_id, v_case_id, null, (v_old - v_ignored)::text, null, v_actor, v_actor_id, now());
  else
    for v_field in
      select key from jsonb_each(v_new)
      where key <> all (v_ignored) and v_new -> key is distinct from v_old -> key
    loop
      insert into public.audit_log (entity, entity_id, case_id, field, old_value, new_value, actor_type, actor_id, at)
      values (
        tg_table_name, v_entity_id, v_case_id, v_field, v_old ->> v_field, v_new ->> v_field,
        v_actor, v_actor_id, now()
      );
    end loop;
  end if;
  return null;
end;
$$;
