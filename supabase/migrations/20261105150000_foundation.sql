-- Iteration 1 – foundation: helper functions, enums, lookups and internal users.
-- Data model: docs/design.md section 1. Naming deviations: docs/decisions.md.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Maintains created_at/created_by/updated_at/updated_by on every table.
-- Signed-in users always get their own id and the current time; the service
-- role (seed, background jobs) may set created_* explicitly, e.g. to backdate.
create function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_at := now();
      new.created_by := auth.uid();
    else
      new.created_at := coalesce(new.created_at, now());
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

revoke all on function public.set_audit_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.account_type as enum (
  'client', 'broker', 'insurer', 'expert', 'repairer', 'leasing_company', 'supplier', 'third_party'
);

create type public.vehicle_category as enum ('electric', 'hybrid', 'diesel', 'petrol', 'light_van');

-- requirements.md section 5
create type public.case_status as enum (
  'client_assignment',
  'intake_first_contact',
  'followup_client',
  'followup_broker_insurer',
  'followup_repairer',
  'followup_expert',
  'followup_repairer_report_ok',
  'followup_delay',
  'invoicing_other',
  'invoicing_ok',
  'closed'
);

create type public.repair_decision as enum ('repair', 'no_repair', 'total_loss');

create type public.party_role as enum (
  'owner_fleet_owner', 'leasing_company', 'driver', 'insured_tenant', 'insurer',
  'intermediary', 'third_party', 'expert', 'repairer'
);

create type public.quote_version as enum ('pre_calculation', 'post_calculation');
create type public.quote_origin as enum ('repairer', 'expert', 'manual', 'ai');
create type public.quote_status as enum ('draft', 'pending_review', 'validated', 'rejected', 'sent');

create type public.quote_line_category as enum (
  'labour', 'parts', 'paint_products', 'smart_repair', 'other_costs', 'fixed_price', 'deduction'
);

create type public.quote_line_sub_type as enum (
  -- labour
  'assembly_disassembly', 'paintwork', 'panel_work', 'preparation', 'finishing',
  -- other_costs
  'environmental_fee', 'anti_rust', 'small_parts', 'polishing', 'covid_flat_fee',
  'cavity_protection', 'diagnostics', 'miscellaneous',
  -- deduction
  'previous_claim', 'wear_and_tear'
);

create type public.assessment_type as enum ('none', 'on_site', 'smart_expertise', 'approval_without_expert');
create type public.invoice_direction as enum ('purchase', 'sales');
create type public.communication_channel as enum ('email', 'phone', 'other');
create type public.communication_direction as enum ('in', 'out');

create type public.document_category as enum (
  'claim_form', 'photo', 'estimate', 'expert_report', 'invoice', 'repair_order',
  'purchase_order', 'generated', 'other'
);

create type public.task_category as enum ('my_tasks', 'repairer_dealer', 'fleet_insurer', 'supplier', 'broker');
create type public.actor_type as enum ('user', 'system', 'agent');

-- Phase-2 hooks (plan.md section 3)
create type public.inbound_parse_status as enum ('new', 'linked', 'triage', 'converted', 'ignored');
create type public.intake_draft_status as enum ('draft', 'in_review', 'accepted', 'rejected');
create type public.outbound_message_status as enum ('draft', 'approved', 'sent', 'failed');
create type public.event_type as enum (
  'case.created', 'status.changed', 'email.received', 'quote.validated', 'message.sent'
);
create type public.completeness_stage as enum ('intake', 'quote', 'invoicing');

-- ---------------------------------------------------------------------------
-- Internal users (design "User"); one row per Supabase Auth user
-- ---------------------------------------------------------------------------

create table public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null,
  email text not null unique,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

-- True for signed-in internal users. Used by every row-level security policy.
create function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_user where id = (select auth.uid()));
$$;

revoke all on function public.is_internal_user() from public, anon;
grant execute on function public.is_internal_user() to authenticated;

-- Creates the profile when a user is added in Supabase Auth (seed script or
-- dashboard). Never fails the sign-up: users without an e-mail are skipped.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_part text;
begin
  if new.email is null then
    return new;
  end if;

  local_part := split_part(new.email, '@', 1);
  insert into public.app_user (id, username, full_name, email)
  values (
    new.id,
    case
      when exists (select 1 from public.app_user where username = local_part) then new.email
      else local_part
    end,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Profiles for users that existed before this migration.
insert into public.app_user (id, username, full_name, email)
select
  u.id,
  case
    when row_number() over (partition by split_part(u.email, '@', 1) order by u.created_at) = 1
      then split_part(u.email, '@', 1)
    else u.email
  end,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), u.email),
  u.email
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Lookups (design.md 1.12). Values other than the part catalog are starter
-- values awaiting confirmation (docs/decisions.md).
-- ---------------------------------------------------------------------------

create table public.on_hold_reason (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_user (id) on delete set null,
  updated_by uuid references public.app_user (id) on delete set null
);

create table public.no_repair_reason (like public.on_hold_reason including all);
create table public.liability (like public.on_hold_reason including all);
create table public.circumstances (like public.on_hold_reason including all);
create table public.part_catalog (like public.on_hold_reason including all);

-- LIKE does not copy foreign keys.
do $$
declare
  t text;
begin
  foreach t in array array['no_repair_reason', 'liability', 'circumstances', 'part_catalog'] loop
    execute format(
      'alter table public.%I
         add foreign key (created_by) references public.app_user (id) on delete set null,
         add foreign key (updated_by) references public.app_user (id) on delete set null',
      t
    );
  end loop;
end
$$;

insert into public.on_hold_reason (code, label, sort_order) values
  ('awaiting_documents', 'Awaiting documents', 10),
  ('awaiting_client', 'Awaiting client', 20),
  ('awaiting_broker_insurer', 'Awaiting broker/insurer decision', 30),
  ('awaiting_parts', 'Awaiting parts', 40),
  ('dispute', 'Dispute', 50),
  ('other', 'Other', 90);

insert into public.no_repair_reason (code, label, sort_order) values
  ('cash_settlement', 'Cash settlement', 10),
  ('below_deductible', 'Damage below deductible', 20),
  ('not_covered', 'Not covered by the policy', 30),
  ('client_declined', 'Client declined the repair', 40),
  ('vehicle_sold_or_returned', 'Vehicle sold or returned', 50),
  ('other', 'Other', 90);

insert into public.liability (code, label, sort_order) values
  ('own_fault', 'Own fault', 10),
  ('third_party_fault', 'Third party at fault', 20),
  ('shared', 'Shared liability', 30),
  ('unknown', 'Unknown', 90);

insert into public.circumstances (code, label, sort_order) values
  ('collision_vehicle', 'Collision with a vehicle', 10),
  ('collision_object', 'Collision with an object', 20),
  ('parking', 'Parking damage', 30),
  ('vandalism', 'Vandalism', 40),
  ('weather', 'Hail or storm', 50),
  ('theft', 'Theft or attempted theft', 60),
  ('glass_breakage', 'Glass breakage', 70),
  ('animal', 'Collision with an animal', 80),
  ('other', 'Other', 90);

-- design.md 1.7; wheel rims and tyres are separate items.
insert into public.part_catalog (code, label, sort_order) values
  ('front_bumper', 'Front bumper', 10),
  ('rear_bumper', 'Rear bumper', 20),
  ('front_door_left', 'Front door left', 30),
  ('front_door_right', 'Front door right', 40),
  ('rear_door_left', 'Rear door left', 50),
  ('rear_door_right', 'Rear door right', 60),
  ('bonnet', 'Bonnet', 70),
  ('roof', 'Roof', 80),
  ('boot', 'Boot', 90),
  ('front_wing_left', 'Front wing left', 100),
  ('front_wing_right', 'Front wing right', 110),
  ('rear_wing_left', 'Rear wing left', 120),
  ('rear_wing_right', 'Rear wing right', 130),
  ('headlight_left', 'Headlight left', 140),
  ('headlight_right', 'Headlight right', 150),
  ('side_mirror_left', 'Side mirror left', 160),
  ('side_mirror_right', 'Side mirror right', 170),
  ('side_window_front_left', 'Side window front left', 180),
  ('side_window_front_right', 'Side window front right', 190),
  ('side_window_rear_left', 'Side window rear left', 200),
  ('side_window_rear_right', 'Side window rear right', 210),
  ('rear_window', 'Rear window', 220),
  ('windscreen', 'Windscreen', 230),
  ('tail_light_left', 'Tail light left', 240),
  ('tail_light_right', 'Tail light right', 250),
  ('wheel_rim_front_left', 'Wheel rim front left', 260),
  ('wheel_rim_front_right', 'Wheel rim front right', 270),
  ('wheel_rim_rear_left', 'Wheel rim rear left', 280),
  ('wheel_rim_rear_right', 'Wheel rim rear right', 290),
  ('tyre_front_left', 'Tyre front left', 300),
  ('tyre_front_right', 'Tyre front right', 310),
  ('tyre_rear_left', 'Tyre rear left', 320),
  ('tyre_rear_right', 'Tyre rear right', 330);

-- ---------------------------------------------------------------------------
-- Triggers, row-level security and grants for this file's tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  -- Read-only for internal users; maintained by migrations and the service role.
  foreach t in array array[
    'app_user', 'on_hold_reason', 'no_repair_reason', 'liability', 'circumstances', 'part_catalog'
  ] loop
    execute format(
      'create trigger set_audit_fields before insert or update on public.%I
         for each row execute function public.set_audit_fields()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy internal_users_read on public.%I
         for select to authenticated using ((select public.is_internal_user()))',
      t
    );
  end loop;
end
$$;
