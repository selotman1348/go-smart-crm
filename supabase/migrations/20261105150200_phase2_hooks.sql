-- Iteration 1 – phase-2 hooks (plan.md section 3, design.md 1.13).
-- Version 1 uses these for the Inbox, drafts and history; AI agents use the
-- same tables in phase 2 ("AI only creates drafts; a human approves").

create table public.inbound_email (
  id uuid primary key default gen_random_uuid(),
  -- RFC 5322 Message-ID, so a re-delivered e-mail is stored only once.
  message_id text unique,
  from_address text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz not null default now(),
  raw_storage_path text,
  parse_status public.inbound_parse_status not null default 'new',
  linked_case_id uuid references public."case" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index inbound_email_parse_status_idx on public.inbound_email (parse_status);
create index inbound_email_linked_case_id_idx on public.inbound_email (linked_case_id);

create table public.inbound_attachment (
  id uuid primary key default gen_random_uuid(),
  inbound_email_id uuid not null references public.inbound_email (id) on delete cascade,
  file_name text not null,
  mime_type text,
  size bigint check (size >= 0),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index inbound_attachment_inbound_email_id_idx on public.inbound_attachment (inbound_email_id);

create table public.intake_draft (
  id uuid primary key default gen_random_uuid(),
  source_email_id uuid not null unique references public.inbound_email (id) on delete cascade,
  proposed_fields jsonb not null default '{}',
  field_confidence jsonb not null default '{}',
  missing_fields text[] not null default '{}',
  status public.intake_draft_status not null default 'draft',
  -- Set when the draft is accepted into a case.
  case_id uuid references public."case" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create table public.outbound_message (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public."case" (id) on delete cascade,
  template_id uuid references public.email_template (id) on delete set null,
  merge_data jsonb not null default '{}',
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  body text,
  status public.outbound_message_status not null default 'draft',
  approved_by uuid references public.app_user (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index outbound_message_case_id_idx on public.outbound_message (case_id);

create table public.event (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null,
  case_id uuid references public."case" (id) on delete set null,
  payload jsonb not null default '{}',
  -- Set by the outbound webhook dispatcher.
  delivered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index event_case_id_idx on public.event (case_id);
create index event_type_created_at_idx on public.event (type, created_at);
create index event_undelivered_idx on public.event (created_at) where not delivered;

create table public.api_client (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- e.g. cases:read, drafts:write. Never final status changes or sending.
  scopes text[] not null default '{}',
  -- Hash of the API key; the key itself is never stored.
  key_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

-- Completeness rules per client and stage: warning markers (BR-13), the
-- invoicing check (BR-08) and, in phase 2, "missing data" e-mails.
create table public.completeness_rule (
  id uuid primary key default gen_random_uuid(),
  -- Null: the rule applies to every client.
  client_account_id uuid references public.account (id) on delete cascade,
  stage public.completeness_stage not null,
  -- A requirement key interpreted by the completeness service, e.g. "case.vda_number".
  requirement text not null check (requirement ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  constraint completeness_rule_unique unique nulls not distinct (client_account_id, stage, requirement)
);

-- ---------------------------------------------------------------------------
-- Reference data for quote suggestions, filled from manual quotes
-- ---------------------------------------------------------------------------

-- Hourly rates per repairer, one row per quote that states a rate.
create view public.repairer_hourly_rate with (security_invoker = true) as
select
  party.account_id as repairer_account_id,
  q.id as quote_id,
  q.case_id,
  q.version,
  q.origin,
  q.hourly_rate_paint,
  q.hourly_rate_assembly,
  q.created_at as quoted_at
from public.quote q
join public.case_party party
  on party.case_id = q.case_id
  and party.role = 'repairer'
  and party.account_id is not null
where q.hourly_rate_paint is not null or q.hourly_rate_assembly is not null;

-- Quote-line history with the vehicle and repairer context of each line.
create view public.quote_line_history with (security_invoker = true) as
select
  line.id as quote_line_id,
  line.category,
  line.sub_type,
  line.description,
  line.amount,
  q.id as quote_id,
  q.version,
  q.origin,
  q.status as quote_status,
  c.id as case_id,
  c.client_account_id,
  repairer.account_id as repairer_account_id,
  v.make,
  v.model,
  v.model_year,
  v.category as vehicle_category,
  line.created_at
from public.quote_line line
join public.quote q on q.id = line.quote_id
join public."case" c on c.id = q.case_id
left join public.vehicle v on v.id = c.vehicle_id
left join lateral (
  select party.account_id
  from public.case_party party
  where party.case_id = c.id and party.role = 'repairer' and party.account_id is not null
  order by party.created_at
  limit 1
) repairer on true;

-- ---------------------------------------------------------------------------
-- Triggers, row-level security and grants for this file's tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'inbound_email', 'inbound_attachment', 'intake_draft', 'outbound_message',
    'event', 'api_client', 'completeness_rule'
  ] loop
    execute format(
      'create trigger set_audit_fields before insert or update on public.%I
         for each row execute function public.set_audit_fields()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;

  foreach t in array array[
    'inbound_email', 'inbound_attachment', 'intake_draft', 'outbound_message', 'completeness_rule'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy internal_users_all on public.%I
         for all to authenticated
         using ((select public.is_internal_user()))
         with check ((select public.is_internal_user()))',
      t
    );
  end loop;

  -- Events are append-only for users; the dispatcher (service role) marks delivery.
  grant select, insert on public.event to authenticated;
  create policy internal_users_read on public.event
    for select to authenticated using ((select public.is_internal_user()));
  create policy internal_users_insert on public.event
    for insert to authenticated with check ((select public.is_internal_user()));

  -- api_client holds key hashes: service role only (no policies for users).

  foreach t in array array['repairer_hourly_rate', 'quote_line_history'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated, service_role', t);
  end loop;
end
$$;
