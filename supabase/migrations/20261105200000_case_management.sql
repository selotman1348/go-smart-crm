-- Iteration 2 – case management: audit trail, status-engine persistence,
-- case-number backstop, list views and document storage.
-- Decisions: docs/decisions.md (iteration 2).

-- ---------------------------------------------------------------------------
-- Audit trail (UC-37): every change to a case and its records
-- ---------------------------------------------------------------------------

-- One audit_log row per inserted or deleted record (the record as JSON), and
-- one per changed field on update. Rows of a deleted case lose their case_id.
create function public.audit_row_change()
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
      coalesce((v_new ->> 'created_at')::timestamptz, now())
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

revoke all on function public.audit_row_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'case', 'case_party', 'damage', 'damaged_part', 'document', 'case_tag', 'vehicle',
    'quote', 'quote_line', 'assessment', 'invoice'
  ] loop
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Case numbers (BR-01): backstop for the numbering service in src/domain
-- ---------------------------------------------------------------------------

create function public.check_case_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client_code text;
begin
  select a.client_code into v_client_code from public.account a where a.id = new.client_account_id;
  if v_client_code is null or new.case_number !~ ('^' || v_client_code || '[0-9]{8}$') then
    raise exception 'Case number % does not start with the client code of the case''s client.', new.case_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_case_number() from public, anon, authenticated;

create trigger check_case_number
  before insert on public."case"
  for each row execute function public.check_case_number();

-- ---------------------------------------------------------------------------
-- Status engine persistence: the status changes only through change_case_status
-- ---------------------------------------------------------------------------

-- Users may not write status, case_number or client_account_id directly.
-- New columns on "case" must be added to these grants.
revoke insert, update on public."case" from authenticated;

grant insert (
  case_number, client_account_id, vehicle_id, manager_user_id, assigned_to_user_id,
  insurer_ref, broker_ref, expert_ref, leasing_ref, vda_number, po_number, policy_number, cover_type,
  vat_liable_pct, deductible, assignment_date, completion_date, collected_date, delivered_date,
  appointment_estimate_at, appointment_repair_at, vehicle_in_date, vehicle_ready_date,
  client_notified_date, vehicle_out_date, on_hold, on_hold_reason, on_hold_reason_text,
  repair_decision, no_repair_reason, no_repair_reason_text
) on public."case" to authenticated;

grant update (
  vehicle_id, manager_user_id, assigned_to_user_id,
  insurer_ref, broker_ref, expert_ref, leasing_ref, vda_number, po_number, policy_number, cover_type,
  vat_liable_pct, deductible, assignment_date, completion_date, collected_date, delivered_date,
  appointment_estimate_at, appointment_repair_at, vehicle_in_date, vehicle_ready_date,
  client_notified_date, vehicle_out_date, on_hold, on_hold_reason, on_hold_reason_text,
  repair_decision, no_repair_reason, no_repair_reason_text
) on public."case" to authenticated;

-- Creates a case with the number chosen by the numbering service, its
-- owner/fleet owner party, the first status-history entry and the
-- case.created event, in one transaction. Row-level security applies.
create function public.create_case(
  p_case_number text,
  p_client_account_id uuid,
  p_owner_account_id uuid,
  p_manager_user_id uuid,
  p_assigned_to_user_id uuid,
  p_assignment_date date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_status public.case_status;
begin
  insert into public."case" (case_number, client_account_id, manager_user_id, assigned_to_user_id, assignment_date)
  values (p_case_number, p_client_account_id, p_manager_user_id, p_assigned_to_user_id, p_assignment_date)
  returning id, status into v_case_id, v_status;

  if p_owner_account_id is not null then
    insert into public.case_party (case_id, role, account_id)
    values (v_case_id, 'owner_fleet_owner', p_owner_account_id);
  end if;

  insert into public.status_history (case_id, from_status, to_status, changed_by)
  values (v_case_id, null, v_status, auth.uid());

  insert into public.event (type, case_id, payload)
  values ('case.created', v_case_id, jsonb_build_object('caseNumber', p_case_number));

  return v_case_id;
end;
$$;

revoke all on function public.create_case(text, uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.create_case(text, uuid, uuid, uuid, uuid, date) to authenticated;

-- Applies a status change decided by the status engine (src/domain): the
-- status, the status-history entry and the status.changed event in one
-- transaction; the audit row comes from the audit trigger. Fails with PT409
-- when the status is no longer p_expected_status.
create function public.change_case_status(
  p_case_id uuid,
  p_expected_status public.case_status,
  p_new_status public.case_status,
  p_automatic boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_number text;
begin
  if not public.is_internal_user() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  if p_automatic then
    perform set_config('app.actor_type', 'system', true);
  end if;

  update public."case"
  set status = p_new_status
  where id = p_case_id and status = p_expected_status
  returning case_number into v_case_number;

  if not found then
    raise exception 'The case status has changed in the meantime.' using errcode = 'PT409';
  end if;

  insert into public.status_history (case_id, from_status, to_status, changed_by, automatic)
  values (p_case_id, p_expected_status, p_new_status, auth.uid(), p_automatic);

  insert into public.event (type, case_id, payload)
  values (
    'status.changed',
    p_case_id,
    jsonb_build_object(
      'caseNumber', v_case_number,
      'from', p_expected_status,
      'to', p_new_status,
      'automatic', p_automatic
    )
  );

  perform set_config('app.actor_type', '', true);
end;
$$;

revoke all on function public.change_case_status(uuid, public.case_status, public.case_status, boolean) from public, anon;
grant execute on function public.change_case_status(uuid, public.case_status, public.case_status, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Case list (UC-04 to UC-06)
-- ---------------------------------------------------------------------------

create view public.case_overview with (security_invoker = true) as
select
  c.id,
  c.case_number,
  c.status,
  c.on_hold,
  c.client_account_id,
  client.name as client_name,
  c.vehicle_id,
  v.licence_plate,
  -- "9-TKA-101", "9 tka 101" and "9TKA101" all match.
  upper(regexp_replace(coalesce(v.licence_plate, ''), '[^A-Za-z0-9]', '', 'g')) as licence_plate_key,
  c.manager_user_id,
  manager.full_name as manager_name,
  c.assigned_to_user_id,
  repairer.account_id as repairer_account_id,
  repairer.name as repairer_name,
  d.damage_date,
  c.assignment_date,
  c.completion_date,
  c.created_at,
  c.insurer_ref,
  c.broker_ref,
  c.expert_ref,
  c.leasing_ref,
  c.policy_number,
  c.vda_number,
  c.po_number
from public."case" c
join public.account client on client.id = c.client_account_id
left join public.vehicle v on v.id = c.vehicle_id
left join public.app_user manager on manager.id = c.manager_user_id
left join public.damage d on d.case_id = c.id
left join lateral (
  select p.account_id, a.name
  from public.case_party p
  join public.account a on a.id = p.account_id
  where p.case_id = c.id and p.role = 'repairer'
  order by p.created_at
  limit 1
) repairer on true;

-- Client tiles: open cases (not closed) per client.
create view public.open_cases_per_client with (security_invoker = true) as
select
  c.client_account_id,
  a.name as client_name,
  a.client_code,
  count(*)::integer as open_cases
from public."case" c
join public.account a on a.id = c.client_account_id
where c.status <> 'closed'
group by c.client_account_id, a.name, a.client_code;

revoke all on public.case_overview, public.open_cases_per_client from anon, authenticated;
grant select on public.case_overview, public.open_cases_per_client to authenticated, service_role;

create index case_created_at_idx on public."case" (created_at);
create index case_assignment_date_idx on public."case" (assignment_date);
create index case_completion_date_idx on public."case" (completion_date);
create index damage_damage_date_idx on public.damage (damage_date);

-- ---------------------------------------------------------------------------
-- Document storage (UC-36): private bucket, internal users only
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'message/rfc822',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy documents_internal_users_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (select public.is_internal_user()));

create policy documents_internal_users_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (select public.is_internal_user()));

create policy documents_internal_users_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (select public.is_internal_user()))
  with check (bucket_id = 'documents' and (select public.is_internal_user()));

create policy documents_internal_users_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (select public.is_internal_user()));
