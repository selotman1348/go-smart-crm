-- Iteration 4 – communication and e-mail intake (UC-13 to UC-15, UC-33 to UC-35).
-- Storage for inbound e-mails, the initial e-mail templates, and RPCs that
-- write a communication with its case links and attachments in one
-- transaction. The decisions (case-number matching BR-10, merge fields,
-- recipients, input checks) are made in src/domain/communications and
-- src/domain/intake.

-- ---------------------------------------------------------------------------
-- Inbound e-mail storage: raw messages and their attachments
-- ---------------------------------------------------------------------------

-- No type restriction: an e-mail may carry any attachment. Attachments of a
-- document type are copied to the documents bucket when the e-mail is linked.
insert into storage.buckets (id, name, public, file_size_limit)
values ('inbound', 'inbound', false, 26214400) -- 25 MB
on conflict (id) do nothing;

drop policy if exists inbound_internal_users_read on storage.objects;
create policy inbound_internal_users_read on storage.objects
  for select to authenticated
  using (bucket_id = 'inbound' and (select public.is_internal_user()));

drop policy if exists inbound_internal_users_insert on storage.objects;
create policy inbound_internal_users_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inbound' and (select public.is_internal_user()));

drop policy if exists inbound_internal_users_delete on storage.objects;
create policy inbound_internal_users_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'inbound' and (select public.is_internal_user()));

-- ---------------------------------------------------------------------------
-- E-mail templates (design.md 1.11): the initial set, in English and Dutch
-- ---------------------------------------------------------------------------

insert into public.email_template (code, name, audience, language, subject, body) values
(
  'new_repair_order', 'New repair order', 'repairer', 'en',
  'New repair order {{case.number}} – {{vehicle.licencePlate}}',
  $t$Dear {{repairer.name}},

Please find attached the repair order for case {{case.number}}.

Vehicle: {{vehicle.make}} {{vehicle.model}}, licence plate {{vehicle.licencePlate}}, VIN {{vehicle.vin}}
Client: {{client.name}}
Driver: {{driver.name}}
Damage date: {{damage.date}}

Please send us your estimate, and always state case number {{case.number}} in the subject of your e-mails.

Invoicing conditions: {{repairer.invoicingConditions}}

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'new_repair_order', 'Nieuwe herstelopdracht', 'repairer', 'nl',
  'Nieuwe herstelopdracht {{case.number}} – {{vehicle.licencePlate}}',
  $t$Beste {{repairer.name}},

In bijlage vindt u de herstelopdracht voor dossier {{case.number}}.

Voertuig: {{vehicle.make}} {{vehicle.model}}, nummerplaat {{vehicle.licencePlate}}, chassisnummer {{vehicle.vin}}
Klant: {{client.name}}
Bestuurder: {{driver.name}}
Schadedatum: {{damage.date}}

Gelieve ons uw bestek te bezorgen en steeds dossiernummer {{case.number}} in het onderwerp van uw e-mails te vermelden.

Facturatievoorwaarden: {{repairer.invoicingConditions}}

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'general', 'General outgoing mail', null, 'en',
  'Case {{case.number}} – {{vehicle.licencePlate}}',
  $t$Dear Sir or Madam,



Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'general', 'Algemene uitgaande mail', null, 'nl',
  'Dossier {{case.number}} – {{vehicle.licencePlate}}',
  $t$Geachte heer, mevrouw,



Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'driver_information', 'Driver information', 'driver', 'en',
  'Your vehicle {{vehicle.licencePlate}} – case {{case.number}}',
  $t$Dear {{driver.name}},

We are handling the damage to vehicle {{vehicle.licencePlate}} on behalf of {{client.name}}. Our case number is {{case.number}}; please state it in all your messages.

We will let you know as soon as the repair has been arranged.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'driver_information', 'Informatie voor de bestuurder', 'driver', 'nl',
  'Uw voertuig {{vehicle.licencePlate}} – dossier {{case.number}}',
  $t$Beste {{driver.name}},

Wij behandelen de schade aan voertuig {{vehicle.licencePlate}} in opdracht van {{client.name}}. Ons dossiernummer is {{case.number}}; gelieve dit in al uw berichten te vermelden.

Wij laten u weten zodra het herstel geregeld is.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'driver_repair_order_delivered', 'Driver information – repair order delivered', 'driver', 'en',
  'Repair of your vehicle {{vehicle.licencePlate}} – case {{case.number}}',
  $t$Dear {{driver.name}},

The repair order for vehicle {{vehicle.licencePlate}} has been sent to:

{{repairer.name}}
{{repairer.address}}
{{repairer.phone}}

The repairer will contact you to make an appointment. Please state case number {{case.number}} if you contact us.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'driver_repair_order_delivered', 'Informatie bestuurder – herstelopdracht verstuurd', 'driver', 'nl',
  'Herstel van uw voertuig {{vehicle.licencePlate}} – dossier {{case.number}}',
  $t$Beste {{driver.name}},

De herstelopdracht voor voertuig {{vehicle.licencePlate}} is verstuurd naar:

{{repairer.name}}
{{repairer.address}}
{{repairer.phone}}

De hersteller neemt contact met u op om een afspraak te maken. Vermeld dossiernummer {{case.number}} als u ons contacteert.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'expert_appointment', 'Expert – information on expert appointment', 'expert', 'en',
  'Assessment order {{case.number}} – {{vehicle.licencePlate}}',
  $t$Dear {{expert.name}},

We ask you to assess the damage to vehicle {{vehicle.make}} {{vehicle.model}}, licence plate {{vehicle.licencePlate}} (case {{case.number}}, insurer reference {{case.insurerRef}}).

The vehicle is at {{repairer.name}}, {{repairer.address}}.

Please send your report, stating case number {{case.number}}, and mention whether the damage was assessed remotely.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'expert_appointment', 'Expert – informatie over de expertiseopdracht', 'expert', 'nl',
  'Expertiseopdracht {{case.number}} – {{vehicle.licencePlate}}',
  $t$Beste {{expert.name}},

Wij vragen u de schade te begroten aan voertuig {{vehicle.make}} {{vehicle.model}}, nummerplaat {{vehicle.licencePlate}} (dossier {{case.number}}, referentie verzekeraar {{case.insurerRef}}).

Het voertuig staat bij {{repairer.name}}, {{repairer.address}}.

Gelieve uw verslag met vermelding van dossiernummer {{case.number}} te bezorgen, en te vermelden of de expertise op afstand gebeurde.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'new_file_intermediary', 'New repair order – opening new file → intermediary', 'intermediary', 'en',
  'New file {{case.number}} – your reference {{case.brokerRef}}',
  $t$Dear {{intermediary.name}},

We have opened case {{case.number}} for vehicle {{vehicle.licencePlate}} of {{client.name}} (your reference {{case.brokerRef}}, policy {{case.policyNumber}}).

The repair order has been sent to {{repairer.name}}. Please state our case number in all correspondence about this damage.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'new_file_intermediary', 'Nieuwe herstelopdracht – opening nieuw dossier → tussenpersoon', 'intermediary', 'nl',
  'Nieuw dossier {{case.number}} – uw referentie {{case.brokerRef}}',
  $t$Beste {{intermediary.name}},

Wij hebben dossier {{case.number}} geopend voor voertuig {{vehicle.licencePlate}} van {{client.name}} (uw referentie {{case.brokerRef}}, polis {{case.policyNumber}}).

De herstelopdracht is verstuurd naar {{repairer.name}}. Gelieve ons dossiernummer te vermelden in alle correspondentie over deze schade.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'repairer_followup', 'New repair order – repairer follow-up', 'repairer', 'en',
  'Follow-up of repair order {{case.number}} – {{vehicle.licencePlate}}',
  $t$Dear {{repairer.name}},

We sent you the repair order for case {{case.number}} (vehicle {{vehicle.licencePlate}}). Could you let us know how the file is progressing and send us your estimate if you have not done so yet?

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'repairer_followup', 'Nieuwe herstelopdracht – opvolging hersteller', 'repairer', 'nl',
  'Opvolging herstelopdracht {{case.number}} – {{vehicle.licencePlate}}',
  $t$Beste {{repairer.name}},

Wij bezorgden u de herstelopdracht voor dossier {{case.number}} (voertuig {{vehicle.licencePlate}}). Kunt u ons laten weten hoe het dossier vordert, en ons uw bestek bezorgen als dat nog niet gebeurd is?

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'invoice_no_approval', 'Invoice – no expert report/approval', 'repairer', 'en',
  'Your invoice for case {{case.number}} – no approval yet',
  $t$Dear {{repairer.name}},

We received your invoice for case {{case.number}} (vehicle {{vehicle.licencePlate}}). We cannot process it yet, because there is no expert report or approval for this repair.

We will contact you as soon as the approval has been received.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'invoice_no_approval', 'Factuur – geen expertiseverslag/akkoord', 'repairer', 'nl',
  'Uw factuur voor dossier {{case.number}} – nog geen akkoord',
  $t$Beste {{repairer.name}},

Wij ontvingen uw factuur voor dossier {{case.number}} (voertuig {{vehicle.licencePlate}}). Wij kunnen ze nog niet verwerken, omdat er geen expertiseverslag of akkoord is voor dit herstel.

Wij contacteren u zodra het akkoord ontvangen is.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'invoice_amount_incorrect', 'Invoice – amount incorrect', 'repairer', 'en',
  'Your invoice for case {{case.number}} – amount incorrect',
  $t$Dear {{repairer.name}},

The amount of your invoice for case {{case.number}} (vehicle {{vehicle.licencePlate}}) does not match the approved amount and the agreed discount of {{repairer.discountPct}}%.

Please send us a credit note and a corrected invoice.

Kind regards,
{{user.fullName}}
{{user.signature}}$t$
),
(
  'invoice_amount_incorrect', 'Factuur – bedrag niet correct', 'repairer', 'nl',
  'Uw factuur voor dossier {{case.number}} – bedrag niet correct',
  $t$Beste {{repairer.name}},

Het bedrag van uw factuur voor dossier {{case.number}} (voertuig {{vehicle.licencePlate}}) komt niet overeen met het goedgekeurde bedrag en de afgesproken korting van {{repairer.discountPct}}%.

Gelieve ons een creditnota en een verbeterde factuur te bezorgen.

Met vriendelijke groeten,
{{user.fullName}}
{{user.signature}}$t$
)
on conflict (code, language) do nothing;

-- ---------------------------------------------------------------------------
-- Communications (UC-33 to UC-35, BR-12)
-- ---------------------------------------------------------------------------

-- Writes a communication, links it to its cases and registers its
-- attachments as documents of the first case. Invoker rights: it writes only
-- what the caller could write row by row (RLS applies).
create or replace function public.insert_communication(
  p_case_ids uuid[],
  p_communication jsonb,
  p_documents jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_case_ids, 1), 0) = 0 then
    raise exception 'A communication needs a case.' using errcode = '23514';
  end if;

  insert into public.communication (
    channel, direction, subject, body, from_address, to_addresses, cc_addresses,
    bcc_addresses, sent_at, processed, template_id, language
  )
  values (
    (p_communication ->> 'channel')::public.communication_channel,
    (p_communication ->> 'direction')::public.communication_direction,
    p_communication ->> 'subject',
    p_communication ->> 'body',
    p_communication ->> 'from_address',
    coalesce(array(select jsonb_array_elements_text(p_communication -> 'to_addresses')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_communication -> 'cc_addresses')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_communication -> 'bcc_addresses')), '{}'),
    coalesce((p_communication ->> 'sent_at')::timestamptz, now()),
    coalesce((p_communication ->> 'processed')::boolean, false),
    (p_communication ->> 'template_id')::uuid,
    p_communication ->> 'language'
  )
  returning id into v_id;

  insert into public.case_communication (case_id, communication_id)
  select distinct case_id, v_id from unnest(p_case_ids) as case_id;

  insert into public.document (id, case_id, communication_id, file_name, size, mime_type, category, storage_path)
  select
    (d ->> 'id')::uuid,
    p_case_ids[1],
    v_id,
    d ->> 'file_name',
    (d ->> 'size')::bigint,
    d ->> 'mime_type',
    (d ->> 'category')::public.document_category,
    d ->> 'storage_path'
  from jsonb_array_elements(coalesce(p_documents, '[]')) as d;

  return v_id;
end;
$$;

revoke all on function public.insert_communication(uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.insert_communication(uuid[], jsonb, jsonb) to authenticated, service_role;

-- UC-35: a phone call or other contact, logged by a user.
create or replace function public.log_communication(
  p_case_id uuid,
  p_communication jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_internal_user() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return public.insert_communication(array[p_case_id], p_communication, '[]');
end;
$$;

revoke all on function public.log_communication(uuid, jsonb) from public, anon;
grant execute on function public.log_communication(uuid, jsonb) to authenticated;

-- UC-33: a message the user approved and the provider accepted. Marks the
-- outbound message as sent and logs it on its cases with the generated
-- attachments, plus the message.sent event.
create or replace function public.record_message_sent(
  p_message_id uuid,
  p_case_ids uuid[],
  p_communication jsonb,
  p_documents jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message public.outbound_message;
  v_communication_id uuid;
begin
  if not public.is_internal_user() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  update public.outbound_message
  set status = 'sent', sent_at = coalesce((p_communication ->> 'sent_at')::timestamptz, now())
  where id = p_message_id and status = 'approved'
  returning * into v_message;
  if not found then
    raise exception 'The message has changed in the meantime.' using errcode = 'PT409';
  end if;

  v_communication_id := public.insert_communication(
    array[v_message.case_id] || p_case_ids,
    p_communication || jsonb_build_object('template_id', v_message.template_id),
    p_documents
  );

  insert into public.event (type, case_id, payload)
  values (
    'message.sent',
    v_message.case_id,
    jsonb_build_object(
      'outboundMessageId', v_message.id,
      'communicationId', v_communication_id,
      'templateId', v_message.template_id,
      'to', v_message.to_addresses
    )
  );

  return v_communication_id;
end;
$$;

revoke all on function public.record_message_sent(uuid, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.record_message_sent(uuid, uuid[], jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- E-mail intake (plan.md 2.1, UC-34, BR-10)
-- ---------------------------------------------------------------------------

-- Stores a received e-mail and its attachments. With matched cases (the
-- subject contains their case numbers, BR-10) it is logged on them at once;
-- otherwise it waits in the Inbox (triage). An e-mail with a Message-ID that
-- was stored before is not stored again. Called by the inbound webhook
-- (service role) and by the Inbox's .eml upload (a user).
create or replace function public.receive_inbound_email(
  p_email jsonb,
  p_attachments jsonb,
  p_case_ids uuid[],
  p_documents jsonb
)
returns table (id uuid, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_linked boolean := coalesce(array_length(p_case_ids, 1), 0) > 0;
begin
  if auth.uid() is not null and not public.is_internal_user() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  insert into public.inbound_email (
    id, message_id, from_address, to_addresses, cc_addresses, subject, body_text, body_html,
    received_at, raw_storage_path, parse_status, linked_case_id
  )
  values (
    (p_email ->> 'id')::uuid,
    p_email ->> 'message_id',
    p_email ->> 'from_address',
    coalesce(array(select jsonb_array_elements_text(p_email -> 'to_addresses')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_email -> 'cc_addresses')), '{}'),
    p_email ->> 'subject',
    p_email ->> 'body_text',
    p_email ->> 'body_html',
    coalesce((p_email ->> 'received_at')::timestamptz, now()),
    p_email ->> 'raw_storage_path',
    case when v_linked then 'linked' else 'triage' end::public.inbound_parse_status,
    p_case_ids[1]
  )
  on conflict (message_id) do nothing
  returning inbound_email.id into v_id;

  if v_id is null then
    return query
      select e.id, true from public.inbound_email e where e.message_id = p_email ->> 'message_id';
    return;
  end if;

  insert into public.inbound_attachment (id, inbound_email_id, file_name, mime_type, size, storage_path)
  select (a ->> 'id')::uuid, v_id, a ->> 'file_name', a ->> 'mime_type', (a ->> 'size')::bigint, a ->> 'storage_path'
  from jsonb_array_elements(coalesce(p_attachments, '[]')) as a;

  if v_linked then
    perform public.insert_communication(
      p_case_ids,
      jsonb_build_object(
        'channel', 'email',
        'direction', 'in',
        'subject', p_email ->> 'subject',
        'body', p_email ->> 'body_text',
        'from_address', p_email ->> 'from_address',
        'to_addresses', coalesce(p_email -> 'to_addresses', '[]'),
        'cc_addresses', coalesce(p_email -> 'cc_addresses', '[]'),
        'sent_at', p_email ->> 'received_at'
      ),
      p_documents
    );
  end if;

  insert into public.event (type, case_id, payload)
  values (
    'email.received',
    p_case_ids[1],
    jsonb_build_object('inboundEmailId', v_id, 'subject', p_email ->> 'subject', 'linked', v_linked)
  );

  return query select v_id, false;
end;
$$;

revoke all on function public.receive_inbound_email(jsonb, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.receive_inbound_email(jsonb, jsonb, uuid[], jsonb) to authenticated, service_role;

-- Inbox actions: "Link to case" (status linked) and "Create case from
-- e-mail" (status converted; its intake draft is accepted into the case).
create or replace function public.link_inbound_email(
  p_email_id uuid,
  p_case_ids uuid[],
  p_converted boolean,
  p_documents jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email public.inbound_email;
  v_communication_id uuid;
begin
  if not public.is_internal_user() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  update public.inbound_email
  set parse_status = case when p_converted then 'converted' else 'linked' end::public.inbound_parse_status,
      linked_case_id = p_case_ids[1]
  where id = p_email_id and parse_status in ('new', 'triage')
  returning * into v_email;
  if not found then
    raise exception 'The e-mail has been handled in the meantime.' using errcode = 'PT409';
  end if;

  v_communication_id := public.insert_communication(
    p_case_ids,
    jsonb_build_object(
      'channel', 'email',
      'direction', 'in',
      'subject', v_email.subject,
      'body', v_email.body_text,
      'from_address', v_email.from_address,
      'to_addresses', to_jsonb(v_email.to_addresses),
      'cc_addresses', to_jsonb(v_email.cc_addresses),
      'sent_at', v_email.received_at
    ),
    p_documents
  );

  if p_converted then
    update public.intake_draft
    set status = 'accepted', case_id = p_case_ids[1]
    where source_email_id = p_email_id;
  end if;

  return v_communication_id;
end;
$$;

revoke all on function public.link_inbound_email(uuid, uuid[], boolean, jsonb) from public, anon;
grant execute on function public.link_inbound_email(uuid, uuid[], boolean, jsonb) to authenticated;
