-- Iteration 3 – quotes and assessment (UC-18 to UC-27).
-- The rules live in src/domain (quote totals, validation, BR-03 to BR-07);
-- these functions persist the domain's decisions in one transaction each.

-- ---------------------------------------------------------------------------
-- Line order: rows created in one transaction get increasing created_at
-- ---------------------------------------------------------------------------

-- now() is fixed for a whole transaction, so quote lines saved together would
-- share created_at and lose their order (design.md has no position field).
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_at := clock_timestamp();
      new.created_by := auth.uid();
    else
      new.created_at := coalesce(new.created_at, clock_timestamp());
    end if;
    new.updated_at := new.created_at;
    new.updated_by := new.created_by;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pre- and post-calculation (UC-18, UC-21)
-- ---------------------------------------------------------------------------

-- Creates or updates the case's quote of this version with its lines: lines
-- with an id are updated, lines without an id are added (in the given order),
-- and stored lines that are not in p_lines are removed. Rejects a validated
-- quote (PT409) and a total that is not the sum of the stored lines.
create function public.save_quote(
  p_case_id uuid,
  p_version public.quote_version,
  p_origin public.quote_origin,
  p_hourly_rate_paint numeric,
  p_hourly_rate_assembly numeric,
  p_lines jsonb,
  p_total numeric,
  p_copied_from_quote_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status public.quote_status;
  v_line jsonb;
  v_sum numeric;
begin
  select q.id, q.status into v_quote_id, v_status
  from public.quote q
  where q.case_id = p_case_id and q.version = p_version
  for update;

  if v_status = 'validated' then
    raise exception 'A validated quote cannot be changed.' using errcode = 'PT409';
  end if;

  if v_quote_id is null then
    insert into public.quote (
      case_id, version, origin, hourly_rate_paint, hourly_rate_assembly, total_excl_vat, copied_from_quote_id
    )
    values (
      p_case_id, p_version, p_origin, p_hourly_rate_paint, p_hourly_rate_assembly, p_total, p_copied_from_quote_id
    )
    returning id into v_quote_id;
  else
    update public.quote
    set origin = p_origin,
        hourly_rate_paint = p_hourly_rate_paint,
        hourly_rate_assembly = p_hourly_rate_assembly,
        total_excl_vat = p_total,
        copied_from_quote_id = coalesce(p_copied_from_quote_id, copied_from_quote_id)
    where id = v_quote_id;
  end if;

  delete from public.quote_line ql
  where ql.quote_id = v_quote_id
    and ql.id not in (
      select (line ->> 'id')::uuid
      from jsonb_array_elements(p_lines) line
      where line ->> 'id' is not null
    );

  update public.quote_line ql
  set category = (line ->> 'category')::public.quote_line_category,
      sub_type = (line ->> 'sub_type')::public.quote_line_sub_type,
      description = line ->> 'description',
      amount = (line ->> 'amount')::numeric
  from jsonb_array_elements(p_lines) line
  where ql.quote_id = v_quote_id
    and ql.id = (line ->> 'id')::uuid
    and (ql.category, ql.sub_type, ql.description, ql.amount) is distinct from (
      (line ->> 'category')::public.quote_line_category,
      (line ->> 'sub_type')::public.quote_line_sub_type,
      line ->> 'description',
      (line ->> 'amount')::numeric
    );

  -- One by one, so each new line gets a later created_at than the previous one.
  for v_line in
    select line from jsonb_array_elements(p_lines) with ordinality as lines(line, position)
    where line ->> 'id' is null
    order by position
  loop
    insert into public.quote_line (quote_id, category, sub_type, description, amount)
    values (
      v_quote_id,
      (v_line ->> 'category')::public.quote_line_category,
      (v_line ->> 'sub_type')::public.quote_line_sub_type,
      v_line ->> 'description',
      (v_line ->> 'amount')::numeric
    );
  end loop;

  select coalesce(sum(ql.amount), 0) into v_sum from public.quote_line ql where ql.quote_id = v_quote_id;
  if v_sum <> p_total then
    raise exception 'The quote total % does not equal the sum of its lines (%).', p_total, v_sum
      using errcode = '23514';
  end if;

  return v_quote_id;
end;
$$;

revoke all on function public.save_quote(uuid, public.quote_version, public.quote_origin, numeric, numeric, jsonb, numeric, uuid) from public, anon;
grant execute on function public.save_quote(uuid, public.quote_version, public.quote_origin, numeric, numeric, jsonb, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Validation (UC-22, BR-03)
-- ---------------------------------------------------------------------------

-- Validates the post-calculation: the quote becomes validated, the assessment
-- records the approval, the quote.validated event is written and, when
-- p_expected_status is given, the status changes automatically to "File
-- follow-up – repairer (expert report OK)" (BR-03), recorded as System.
create function public.validate_quote(
  p_quote_id uuid,
  p_assessment_type public.assessment_type,
  p_expert_account_id uuid,
  p_vat_applicable boolean,
  p_approved_amount_excl_vat numeric,
  p_approved_amount_incl_vat numeric,
  p_loss_of_use_days integer,
  p_expected_status public.case_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_version public.quote_version;
  v_status public.quote_status;
  v_case_number text;
begin
  select q.case_id, q.version, q.status into v_case_id, v_version, v_status
  from public.quote q
  where q.id = p_quote_id
  for update;

  if v_case_id is null then
    raise exception 'The quote does not exist.' using errcode = 'P0002';
  end if;
  if v_version <> 'post_calculation' then
    raise exception 'Only the post-calculation is validated.' using errcode = '23514';
  end if;
  if v_status = 'validated' then
    raise exception 'The quote is already validated.' using errcode = 'PT409';
  end if;

  update public.quote set status = 'validated' where id = p_quote_id;

  insert into public.assessment (
    case_id, assessment_type, expert_account_id, vat_applicable,
    approved_amount_excl_vat, approved_amount_incl_vat, loss_of_use_days, validated_at, validated_by
  )
  values (
    v_case_id, p_assessment_type, p_expert_account_id, p_vat_applicable,
    p_approved_amount_excl_vat, p_approved_amount_incl_vat, p_loss_of_use_days, now(), auth.uid()
  )
  on conflict (case_id) do update
  set assessment_type = excluded.assessment_type,
      expert_account_id = excluded.expert_account_id,
      vat_applicable = excluded.vat_applicable,
      approved_amount_excl_vat = excluded.approved_amount_excl_vat,
      approved_amount_incl_vat = excluded.approved_amount_incl_vat,
      loss_of_use_days = excluded.loss_of_use_days,
      validated_at = excluded.validated_at,
      validated_by = excluded.validated_by;

  select c.case_number into v_case_number from public."case" c where c.id = v_case_id;
  insert into public.event (type, case_id, payload)
  values (
    'quote.validated',
    v_case_id,
    jsonb_build_object(
      'caseNumber', v_case_number,
      'quoteId', p_quote_id,
      'assessmentType', p_assessment_type,
      'approvedAmountExclVat', p_approved_amount_excl_vat
    )
  );

  if p_expected_status is not null then
    perform public.change_case_status(v_case_id, p_expected_status, 'followup_repairer_report_ok', true);
  end if;
end;
$$;

revoke all on function public.validate_quote(uuid, public.assessment_type, uuid, boolean, numeric, numeric, integer, public.case_status) from public, anon;
grant execute on function public.validate_quote(uuid, public.assessment_type, uuid, boolean, numeric, numeric, integer, public.case_status) to authenticated;

-- ---------------------------------------------------------------------------
-- No repair (UC-27, BR-07) and total loss (UC-26)
-- ---------------------------------------------------------------------------

-- Records the repair decision and closes the case (a manual status change by
-- the user, through change_case_status).
create function public.record_repair_decision(
  p_case_id uuid,
  p_decision public.repair_decision,
  p_no_repair_reason text,
  p_no_repair_reason_text text,
  p_total_loss_vehicle_value numeric,
  p_total_loss_previous_damage_deduction numeric,
  p_total_loss_accessories numeric,
  p_total_loss_wreck_value numeric,
  p_total_loss_damage_amount numeric,
  p_expected_status public.case_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_decision = 'repair' then
    raise exception 'Only no repair and total loss close the case here.' using errcode = '23514';
  end if;

  update public."case"
  set repair_decision = p_decision,
      no_repair_reason = case when p_decision = 'no_repair' then p_no_repair_reason end,
      no_repair_reason_text = case when p_decision = 'no_repair' then p_no_repair_reason_text end
  where id = p_case_id;
  if not found then
    raise exception 'The case does not exist.' using errcode = 'P0002';
  end if;

  if p_decision = 'total_loss' then
    insert into public.assessment (
      case_id, total_loss_vehicle_value, total_loss_previous_damage_deduction,
      total_loss_accessories, total_loss_wreck_value, total_loss_damage_amount
    )
    values (
      p_case_id, p_total_loss_vehicle_value, p_total_loss_previous_damage_deduction,
      p_total_loss_accessories, p_total_loss_wreck_value, p_total_loss_damage_amount
    )
    on conflict (case_id) do update
    set total_loss_vehicle_value = excluded.total_loss_vehicle_value,
        total_loss_previous_damage_deduction = excluded.total_loss_previous_damage_deduction,
        total_loss_accessories = excluded.total_loss_accessories,
        total_loss_wreck_value = excluded.total_loss_wreck_value,
        total_loss_damage_amount = excluded.total_loss_damage_amount;
  end if;

  perform public.change_case_status(p_case_id, p_expected_status, 'closed', false);
end;
$$;

revoke all on function public.record_repair_decision(uuid, public.repair_decision, text, text, numeric, numeric, numeric, numeric, numeric, public.case_status) from public, anon;
grant execute on function public.record_repair_decision(uuid, public.repair_decision, text, text, numeric, numeric, numeric, numeric, numeric, public.case_status) to authenticated;
