-- Iteration 5 – invoicing (UC-29 to UC-31, BR-08), tasks (UC-03) and the
-- remaining phase-2 hooks (plan.md section 3): API clients that only create
-- drafts, and counts for the dashboard. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Invoices: one repairer invoice and one sales invoice per case
-- ---------------------------------------------------------------------------

create unique index if not exists invoice_case_direction_key on public.invoice (case_id, direction);

-- BR-08: "Invoicing – OK" needs the estimate, the approval or expert report,
-- and the repairer invoice. The requirement keys are interpreted by
-- src/domain/invoicing/completeness.ts; rules with a client apply to that
-- client only.
insert into public.completeness_rule (client_account_id, stage, requirement) values
  (null, 'invoicing', 'quote.estimate'),
  (null, 'invoicing', 'assessment.approval_or_expert_report'),
  (null, 'invoicing', 'invoice.repairer_invoice')
on conflict on constraint completeness_rule_unique do nothing;

-- UC-31: records the sales invoice number from accounting and closes the
-- case, as the user's manual status change.
create or replace function public.record_sales_invoice(
  p_case_id uuid,
  p_invoice_number text,
  p_amount_excl_vat numeric,
  p_expected_status public.case_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.invoice (case_id, direction, invoice_number, amount_excl_vat)
  values (p_case_id, 'sales', p_invoice_number, p_amount_excl_vat)
  on conflict (case_id, direction) do update
  set invoice_number = excluded.invoice_number,
      amount_excl_vat = excluded.amount_excl_vat;

  perform public.change_case_status(p_case_id, p_expected_status, 'closed', false);
end;
$$;

revoke all on function public.record_sales_invoice(uuid, text, numeric, public.case_status) from public, anon;
grant execute on function public.record_sales_invoice(uuid, text, numeric, public.case_status) to authenticated;

-- ---------------------------------------------------------------------------
-- External agents (API clients): drafts only, traced as actor "agent"
-- ---------------------------------------------------------------------------

-- An e-mail draft proposed by an API client. A user reviews and sends it
-- (plan.md section 3: AI only creates drafts; a human approves).
create or replace function public.agent_create_outbound_draft(
  p_api_client_id uuid,
  p_case_id uuid,
  p_template_id uuid,
  p_to text[],
  p_cc text[],
  p_subject text,
  p_body text,
  p_merge_data jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.api_client c where c.id = p_api_client_id and c.active) then
    raise exception 'Unknown API client.' using errcode = '42501';
  end if;

  insert into public.outbound_message (case_id, template_id, merge_data, to_addresses, cc_addresses, subject, body, status)
  values (p_case_id, p_template_id, coalesce(p_merge_data, '{}'), coalesce(p_to, '{}'), coalesce(p_cc, '{}'), p_subject, p_body, 'draft')
  returning id into v_id;

  insert into public.audit_log (entity, entity_id, case_id, new_value, actor_type, actor_id)
  values (
    'outbound_message', v_id, p_case_id,
    jsonb_build_object('subject', p_subject, 'to_addresses', p_to, 'status', 'draft')::text,
    'agent', p_api_client_id
  );
  return v_id;
end;
$$;

revoke all on function public.agent_create_outbound_draft(uuid, uuid, uuid, text[], text[], text, text, jsonb) from public, anon, authenticated;
grant execute on function public.agent_create_outbound_draft(uuid, uuid, uuid, text[], text[], text, text, jsonb) to service_role;

-- Proposed case data for an inbound e-mail (the intake draft): the reviewer
-- accepts it through "Create case from e-mail".
create or replace function public.agent_propose_intake(
  p_api_client_id uuid,
  p_email_id uuid,
  p_proposed_fields jsonb,
  p_field_confidence jsonb,
  p_missing_fields text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.api_client c where c.id = p_api_client_id and c.active) then
    raise exception 'Unknown API client.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inbound_email e where e.id = p_email_id and e.parse_status in ('new', 'triage')) then
    raise exception 'The e-mail is not waiting for triage.' using errcode = 'PT409';
  end if;

  insert into public.intake_draft (source_email_id, proposed_fields, field_confidence, missing_fields, status)
  values (p_email_id, coalesce(p_proposed_fields, '{}'), coalesce(p_field_confidence, '{}'), coalesce(p_missing_fields, '{}'), 'in_review')
  on conflict (source_email_id) do update
  set proposed_fields = excluded.proposed_fields,
      field_confidence = excluded.field_confidence,
      missing_fields = excluded.missing_fields,
      status = 'in_review'
  returning id into v_id;

  insert into public.audit_log (entity, entity_id, case_id, new_value, actor_type, actor_id)
  values (
    'intake_draft', v_id, null,
    jsonb_build_object('source_email_id', p_email_id, 'missing_fields', p_missing_fields)::text,
    'agent', p_api_client_id
  );
  return v_id;
end;
$$;

revoke all on function public.agent_propose_intake(uuid, uuid, jsonb, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.agent_propose_intake(uuid, uuid, jsonb, jsonb, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard: what the phase-2 hooks hold (demo script step 8)
-- ---------------------------------------------------------------------------

-- api_client is service-role only, so the counts come from a definer
-- function that returns numbers, never keys.
create or replace function public.phase2_hook_counts()
returns table (
  intake_drafts bigint,
  outbound_drafts bigint,
  undelivered_events bigint,
  active_api_clients bigint,
  completeness_rules bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.intake_draft where status in ('draft', 'in_review')),
    (select count(*) from public.outbound_message where status = 'draft'),
    (select count(*) from public.event where not delivered),
    (select count(*) from public.api_client where active),
    (select count(*) from public.completeness_rule where active)
  where public.is_internal_user();
$$;

revoke all on function public.phase2_hook_counts() from public, anon;
grant execute on function public.phase2_hook_counts() to authenticated;
