-- Iteration 1 – CRM records and cases (design.md 1.2 to 1.12).
-- "case" is a reserved word: always quote it in SQL.

-- ---------------------------------------------------------------------------
-- Accounts, contacts, vehicles
-- ---------------------------------------------------------------------------

create table public.account (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  account_type public.account_type[] not null check (cardinality(account_type) > 0),
  client_code text unique check (client_code ~ '^[A-Z]{3,4}$'),
  parent_account_id uuid references public.account (id) on delete set null,
  vat_number text,
  vat_liable boolean not null default false,
  address_line1 text,
  address_line2 text,
  postcode text,
  city text,
  country text,
  phone text,
  email text,
  invoicing_conditions text,
  discount_pct numeric(5, 2) check (discount_pct between 0 and 100),
  requires_vda_po boolean not null default false,
  is_network_member boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  -- The client code is the case-number prefix (BR-01): clients only, and every client has one.
  constraint account_client_code_iff_client
    check ((client_code is not null) = ('client' = any (account_type))),
  constraint account_not_own_parent check (parent_account_id <> id)
);

create index account_parent_account_id_idx on public.account (parent_account_id);
create index account_account_type_idx on public.account using gin (account_type);

create table public.contact (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.account (id) on delete restrict,
  salutation text,
  first_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index contact_account_id_idx on public.contact (account_id);

create table public.vehicle (
  id uuid primary key default gen_random_uuid(),
  licence_plate text not null,
  vin text unique check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  first_registration_date date,
  make text,
  model text,
  model_year integer check (model_year between 1900 and 2100),
  type_designation text,
  category public.vehicle_category,
  colour text,
  paint_type text,
  owner_account_id uuid references public.account (id) on delete set null,
  leasing_account_id uuid references public.account (id) on delete set null,
  power_kw integer check (power_kw >= 0),
  engine_cc integer check (engine_cc >= 0),
  co2 integer check (co2 >= 0),
  seats integer check (seats > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

-- Not unique: a plate can move to another vehicle over time.
create index vehicle_licence_plate_idx on public.vehicle (licence_plate);
create index vehicle_owner_account_id_idx on public.vehicle (owner_account_id);
create index vehicle_leasing_account_id_idx on public.vehicle (leasing_account_id);

-- ---------------------------------------------------------------------------
-- Cases
-- ---------------------------------------------------------------------------

create table public."case" (
  id uuid primary key default gen_random_uuid(),
  -- BR-01: client code + 4-digit year + 4-digit sequence per client per year.
  case_number text not null unique check (case_number ~ '^[A-Z]{3,4}[0-9]{8}$'),
  client_account_id uuid not null references public.account (id) on delete restrict,
  vehicle_id uuid references public.vehicle (id) on delete restrict,
  status public.case_status not null default 'client_assignment',
  manager_user_id uuid references public.app_user (id) on delete set null,
  assigned_to_user_id uuid references public.app_user (id) on delete set null,
  insurer_ref text,
  broker_ref text,
  expert_ref text,
  leasing_ref text,
  vda_number text,
  po_number text,
  policy_number text,
  cover_type text,
  vat_liable_pct numeric(5, 2) check (vat_liable_pct between 0 and 100),
  deductible numeric(12, 2) check (deductible >= 0),
  assignment_date date,
  completion_date date,
  collected_date date,
  delivered_date date,
  appointment_estimate_at timestamptz,
  appointment_repair_at timestamptz,
  vehicle_in_date date,
  vehicle_ready_date date,
  client_notified_date date,
  vehicle_out_date date,
  on_hold boolean not null default false,
  on_hold_reason text references public.on_hold_reason (code) on update cascade,
  on_hold_reason_text text,
  repair_decision public.repair_decision,
  no_repair_reason text references public.no_repair_reason (code) on update cascade,
  no_repair_reason_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index case_client_account_id_idx on public."case" (client_account_id);
create index case_vehicle_id_idx on public."case" (vehicle_id);
create index case_status_idx on public."case" (status);
create index case_manager_user_id_idx on public."case" (manager_user_id);
create index case_assigned_to_user_id_idx on public."case" (assigned_to_user_id);

create table public.case_party (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public."case" (id) on delete cascade,
  role public.party_role not null,
  account_id uuid references public.account (id) on delete restrict,
  contact_id uuid references public.contact (id) on delete restrict,
  -- BR-02: the owner/fleet owner is the invoice party.
  is_invoice_party boolean generated always as (role = 'owner_fleet_owner') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  constraint case_party_account_or_contact check (account_id is not null or contact_id is not null),
  constraint case_party_unique unique nulls not distinct (case_id, role, account_id, contact_id)
);

-- One invoice party per case.
create unique index case_party_one_owner_fleet_owner_idx
  on public.case_party (case_id) where role = 'owner_fleet_owner';
create index case_party_account_id_idx on public.case_party (account_id);
create index case_party_contact_id_idx on public.case_party (contact_id);

create table public.damage (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public."case" (id) on delete cascade,
  damage_date date,
  mileage_in integer check (mileage_in >= 0),
  mileage_out integer check (mileage_out >= 0),
  address_line1 text,
  address_line2 text,
  postcode text,
  city text,
  country text,
  cause text,
  liability text references public.liability (code) on update cascade,
  circumstances text references public.circumstances (code) on update cascade,
  extra_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  constraint damage_mileage_out_not_below_in
    check (mileage_in is null or mileage_out is null or mileage_out >= mileage_in)
);

create table public.damaged_part (
  damage_id uuid not null references public.damage (id) on delete cascade,
  part_code text not null references public.part_catalog (code) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  primary key (damage_id, part_code)
);

-- ---------------------------------------------------------------------------
-- Communication and documents
-- ---------------------------------------------------------------------------

create table public.email_template (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  audience text,
  language text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  unique (code, language)
);

create table public.communication (
  id uuid primary key default gen_random_uuid(),
  channel public.communication_channel not null,
  direction public.communication_direction not null,
  subject text,
  body text,
  from_address text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  sent_at timestamptz,
  processed boolean not null default false,
  template_id uuid references public.email_template (id) on delete set null,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

-- BR-12: one communication can be linked to several cases.
create table public.case_communication (
  case_id uuid not null references public."case" (id) on delete cascade,
  communication_id uuid not null references public.communication (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  primary key (case_id, communication_id)
);

create index case_communication_communication_id_idx on public.case_communication (communication_id);

create table public.document (
  id uuid primary key default gen_random_uuid(),
  -- Null for shared documents (UC-36).
  case_id uuid references public."case" (id) on delete cascade,
  communication_id uuid references public.communication (id) on delete set null,
  file_name text not null,
  size bigint check (size >= 0),
  mime_type text,
  category public.document_category not null default 'other',
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index document_case_id_idx on public.document (case_id);
create index document_communication_id_idx on public.document (communication_id);

-- ---------------------------------------------------------------------------
-- Quotes, assessment, invoices
-- ---------------------------------------------------------------------------

create table public.quote (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public."case" (id) on delete cascade,
  version public.quote_version not null,
  origin public.quote_origin not null default 'manual',
  status public.quote_status not null default 'draft',
  copied_from_quote_id uuid references public.quote (id) on delete set null,
  hourly_rate_paint numeric(10, 2) check (hourly_rate_paint >= 0),
  hourly_rate_assembly numeric(10, 2) check (hourly_rate_assembly >= 0),
  -- Derived from the lines by the quote service (src/domain).
  total_excl_vat numeric(12, 2) not null default 0,
  -- Phase-2 hooks; empty in version 1.
  generated_by text,
  model_version text,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  -- Up to two versions per case: one pre- and one post-calculation.
  unique (case_id, version)
);

create table public.quote_line (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote (id) on delete cascade,
  category public.quote_line_category not null,
  sub_type public.quote_line_sub_type,
  description text,
  amount numeric(12, 2) not null,
  -- Phase-2 hook.
  source_refs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  constraint quote_line_sub_type_matches_category check (
    case category
      when 'labour' then sub_type is null
        or sub_type in ('assembly_disassembly', 'paintwork', 'panel_work', 'preparation', 'finishing')
      when 'other_costs' then sub_type is null
        or sub_type in (
          'environmental_fee', 'anti_rust', 'small_parts', 'polishing', 'covid_flat_fee',
          'cavity_protection', 'diagnostics', 'miscellaneous'
        )
      when 'deduction' then sub_type is null or sub_type in ('previous_claim', 'wear_and_tear')
      else sub_type is null
    end
  ),
  constraint quote_line_deduction_not_positive check (category <> 'deduction' or amount <= 0)
);

create index quote_line_quote_id_idx on public.quote_line (quote_id);

create table public.assessment (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public."case" (id) on delete cascade,
  assessment_type public.assessment_type not null default 'none',
  expert_account_id uuid references public.account (id) on delete set null,
  vat_applicable boolean,
  approved_amount_excl_vat numeric(12, 2),
  approved_amount_incl_vat numeric(12, 2),
  -- BR-05: the repair duration stated by the expert.
  loss_of_use_days integer check (loss_of_use_days >= 0),
  expert_report_document_id uuid references public.document (id) on delete set null,
  total_loss_vehicle_value numeric(12, 2),
  total_loss_previous_damage_deduction numeric(12, 2),
  total_loss_accessories numeric(12, 2),
  total_loss_wreck_value numeric(12, 2),
  total_loss_damage_amount numeric(12, 2),
  validated_at timestamptz,
  validated_by uuid references public.app_user (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create table public.invoice (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public."case" (id) on delete cascade,
  direction public.invoice_direction not null,
  received boolean not null default false,
  received_date date,
  invoice_number text,
  amount_excl_vat numeric(12, 2),
  document_id uuid references public.document (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index invoice_case_id_idx on public.invoice (case_id);

-- ---------------------------------------------------------------------------
-- Tasks, tags, history
-- ---------------------------------------------------------------------------

create table public.task (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category public.task_category not null,
  due_date date,
  assignee_user_id uuid references public.app_user (id) on delete set null,
  case_id uuid references public."case" (id) on delete cascade,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index task_assignee_user_id_idx on public.task (assignee_user_id);
create index task_case_id_idx on public.task (case_id);

create table public.tag (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create unique index tag_name_idx on public.tag (lower(name));

create table public.case_tag (
  case_id uuid not null references public."case" (id) on delete cascade,
  tag_id uuid not null references public.tag (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null,
  primary key (case_id, tag_id)
);

create index case_tag_tag_id_idx on public.case_tag (tag_id);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public."case" (id) on delete cascade,
  from_status public.case_status,
  to_status public.case_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.app_user (id) on delete set null,
  automatic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index status_history_case_id_idx on public.status_history (case_id, changed_at);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  -- The case the change belongs to, so the History tab (UC-37) can show
  -- changes to child records too.
  case_id uuid references public."case" (id) on delete set null,
  field text,
  old_value text,
  new_value text,
  actor_type public.actor_type not null,
  -- A user or API client id, depending on actor_type.
  actor_id uuid,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create index audit_log_case_id_idx on public.audit_log (case_id, at);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Triggers, row-level security and grants for this file's tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'account', 'contact', 'vehicle', 'case', 'case_party', 'damage', 'damaged_part',
    'email_template', 'communication', 'case_communication', 'document',
    'quote', 'quote_line', 'assessment', 'invoice', 'task', 'tag', 'case_tag',
    'status_history', 'audit_log'
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

  -- Business records: full access for internal users (Q-002: no per-role rights yet).
  foreach t in array array[
    'account', 'contact', 'vehicle', 'case', 'case_party', 'damage', 'damaged_part',
    'email_template', 'communication', 'case_communication', 'document',
    'quote', 'quote_line', 'assessment', 'invoice', 'task', 'tag', 'case_tag'
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

  -- History is append-only.
  foreach t in array array['status_history', 'audit_log'] loop
    execute format('grant select, insert on public.%I to authenticated', t);
    execute format(
      'create policy internal_users_read on public.%I
         for select to authenticated using ((select public.is_internal_user()))',
      t
    );
    execute format(
      'create policy internal_users_insert on public.%I
         for insert to authenticated with check ((select public.is_internal_user()))',
      t
    );
  end loop;
end
$$;
