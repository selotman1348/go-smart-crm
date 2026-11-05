# Go Smart CRM – Design

This document defines the data model, case lifecycle, main sequences and solution architecture for the requirements in `requirements.md`.

## 1. Data model

### 1.1 Entity relationship diagram

All organisations (client, broker, insurer, expert, repairer, leasing company, supplier, third party) are one **Account** object with a type. People are **Contacts** under an Account. A **Case** links one Vehicle and one client Account, and has party roles, one Damage, up to two Quote versions, an Assessment, Invoices, Communications and Documents.

```mermaid
erDiagram
    ACCOUNT ||--o{ CONTACT : employs
    ACCOUNT ||--o{ CASE : "is client of"
    ACCOUNT ||--o{ VEHICLE : owns
    VEHICLE ||--o{ CASE : "is subject of"
    CASE ||--o{ CASE_PARTY : "has roles"
    ACCOUNT ||--o{ CASE_PARTY : plays
    CONTACT ||--o{ CASE_PARTY : plays
    CASE ||--|| DAMAGE : describes
    DAMAGE ||--o{ DAMAGED_PART : includes
    PART_CATALOG ||--o{ DAMAGED_PART : "typed by"
    CASE ||--o{ QUOTE : "has (pre / post)"
    QUOTE ||--o{ QUOTE_LINE : contains
    CASE ||--o| ASSESSMENT : "approved by"
    ACCOUNT ||--o{ ASSESSMENT : "expert performs"
    CASE ||--o{ INVOICE : "invoiced via"
    CASE }o--o{ COMMUNICATION : "linked to"
    COMMUNICATION ||--o{ DOCUMENT : attaches
    EMAIL_TEMPLATE ||--o{ COMMUNICATION : generates
    CASE ||--o{ DOCUMENT : stores
    CASE ||--o{ STATUS_HISTORY : tracks
    CASE ||--o{ AUDIT_LOG : audits
    CASE ||--o{ TASK : has
    CASE }o--o{ TAG : tagged
    USER ||--o{ CASE : manages
    USER ||--o{ TASK : assigned
    INBOUND_EMAIL }o--o| CASE : "linked to"
    INBOUND_EMAIL ||--o| INTAKE_DRAFT : "source of"
    CASE ||--o{ OUTBOUND_MESSAGE : drafts
    CASE ||--o{ EVENT : emits

    ACCOUNT {
        uuid id PK
        string name
        enum account_type
        string client_code UK
        uuid parent_account_id FK
    }
    CONTACT {
        uuid id PK
        uuid account_id FK
        string first_name
        string last_name
        string email
    }
    VEHICLE {
        uuid id PK
        string licence_plate
        string vin UK
        string make
        string model
    }
    CASE {
        uuid id PK
        string case_number UK
        uuid client_account_id FK
        uuid vehicle_id FK
        enum status
        uuid manager_user_id FK
    }
    CASE_PARTY {
        uuid id PK
        uuid case_id FK
        enum role
        uuid account_id FK
        uuid contact_id FK
    }
    DAMAGE {
        uuid id PK
        uuid case_id FK
        date damage_date
        text cause
    }
    QUOTE {
        uuid id PK
        uuid case_id FK
        enum version
        enum status
        enum origin
    }
    QUOTE_LINE {
        uuid id PK
        uuid quote_id FK
        enum category
        enum sub_type
        decimal amount
    }
    ASSESSMENT {
        uuid id PK
        uuid case_id FK
        enum assessment_type
        decimal approved_amount_excl_vat
    }
    INVOICE {
        uuid id PK
        uuid case_id FK
        enum direction
        string invoice_number
    }
    COMMUNICATION {
        uuid id PK
        enum channel
        enum direction
        string subject
    }
```

The diagram shows key attributes only. Full attribute lists follow. Every table also has `created_at`, `updated_at`, `created_by` and `updated_by`.

### 1.2 Account

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| name | text | |
| account_type | enum (multi-value) | client, broker, insurer, expert, repairer, leasing_company, supplier, third_party |
| client_code | text (3–4), unique | Case-number prefix; clients only |
| parent_account_id | FK Account | Groups of companies |
| vat_number | text | |
| vat_liable | boolean | |
| address_line1, address_line2, postcode, city, country | text | |
| phone, email | text | |
| invoicing_conditions | text | Printed on the repair order (BR-09) |
| discount_pct | decimal | Repairer discount agreement (BR-09) |
| requires_vda_po | boolean | Client needs VDA and PO references (BR-11) |
| is_network_member | boolean | Repairer belongs to the repair network |

### 1.3 Contact

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| account_id | FK Account | Employer organisation |
| salutation | text | |
| first_name, last_name | text | |
| email | text | |
| phone | text | |

### 1.4 Vehicle

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| licence_plate | text, indexed | Not unique over time |
| vin | text (17), unique | Chassis number |
| first_registration_date | date | |
| make, model | text | |
| model_year | integer | |
| type_designation | text | |
| category | enum | e.g. electric, hybrid, diesel, petrol, light van |
| colour, paint_type | text | |
| owner_account_id | FK Account | Fleet owner |
| leasing_account_id | FK Account | |
| power_kw, engine_cc, co2, seats | integer | Optional; often taken from expert reports |

### 1.5 Case

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| case_number | text, unique | Client code + YYYY + 4-digit sequence (BR-01) |
| client_account_id | FK Account | |
| vehicle_id | FK Vehicle | |
| status | enum | See section 2 |
| manager_user_id | FK User | Case manager |
| assigned_to_user_id | FK User | |
| insurer_ref, broker_ref, expert_ref, leasing_ref | text | |
| vda_number, po_number | text | Client-specific references (BR-11) |
| policy_number, cover_type | text | |
| vat_liable_pct | decimal | e.g. 35% |
| deductible | decimal | |
| assignment_date, completion_date, collected_date, delivered_date | date | |
| appointment_estimate_at, appointment_repair_at | timestamp | |
| vehicle_in_date, vehicle_ready_date, client_notified_date, vehicle_out_date | date | |
| on_hold | boolean | |
| on_hold_reason | enum + text | |
| repair_decision | enum | repair, no_repair, total_loss |
| no_repair_reason | enum + text | |

### 1.6 Case party

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| case_id | FK Case | |
| role | enum | owner_fleet_owner, leasing_company, driver, insured_tenant, insurer, intermediary, third_party, expert, repairer |
| account_id | FK Account | For organisations |
| contact_id | FK Contact | For people |
| is_invoice_party | boolean | True for owner_fleet_owner (BR-02) |

### 1.7 Damage and damaged parts

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | One per case |
| case_id | FK Case | |
| damage_date | date | |
| mileage_in, mileage_out | integer | |
| address_line1, address_line2, postcode, city, country | text | Damage location |
| cause | text | |
| liability | enum | |
| circumstances | enum | |
| extra_info | text | |
| **DamagedPart** (damage_id, part_code) | join table | Part catalog: rear/front bumper; rear/front door left/right; bonnet; roof; boot; front/rear wing left/right; headlight left/right; side mirror left/right; side windows front/rear left/right; rear window; windscreen; tail light left/right; wheel rims and tyres front/rear left/right |

### 1.8 Quote and quote line

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| case_id | FK Case | |
| version | enum | pre_calculation, post_calculation |
| origin | enum | repairer, expert, manual, ai (phase 2) |
| status | enum | draft, pending_review, validated, rejected, sent |
| copied_from_quote_id | FK Quote | "Copy from pre-calculation" |
| hourly_rate_paint, hourly_rate_assembly | decimal | |
| total_excl_vat | decimal | Derived from lines |
| generated_by, model_version, rationale | text | Phase-2 hooks, empty in version 1 |
| **QuoteLine** category | enum | labour, parts, paint_products, smart_repair, other_costs, fixed_price, deduction |
| **QuoteLine** sub_type | enum | Labour: assembly_disassembly, paintwork, panel_work, preparation, finishing. Other costs: environmental_fee, anti_rust, small_parts, polishing, covid_flat_fee, cavity_protection, diagnostics, miscellaneous. Deduction: previous_claim, wear_and_tear |
| **QuoteLine** description, amount | text, decimal | Deductions are negative |
| **QuoteLine** source_refs | jsonb | Phase-2 hook |

### 1.9 Assessment

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | One per case |
| case_id | FK Case | |
| assessment_type | enum | none, on_site, smart_expertise, approval_without_expert |
| expert_account_id | FK Account | |
| vat_applicable | boolean | |
| approved_amount_excl_vat, approved_amount_incl_vat | decimal | |
| loss_of_use_days | integer | BR-05 |
| expert_report_document_id | FK Document | |
| total_loss_vehicle_value, total_loss_previous_damage_deduction, total_loss_accessories, total_loss_wreck_value, total_loss_damage_amount | decimal | UC-26 |
| validated_at, validated_by | timestamp, FK User | |

### 1.10 Invoice

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| case_id | FK Case | |
| direction | enum | purchase (repairer → company), sales (company → client) |
| received | boolean | Repairer invoice |
| received_date | date | |
| invoice_number | text | Sales invoice number from accounting |
| amount_excl_vat | decimal | |
| document_id | FK Document | |

### 1.11 Communication, e-mail template, document

| Object | Fields |
| --- | --- |
| Communication | id, channel (email, phone, other), direction (in, out), subject, body (rich text), from, to, cc, bcc, sent_at, processed (boolean), template_id, language; many-to-many with Case (BR-12) |
| EmailTemplate | id, code, name, audience, language, subject, body with merge fields. Initial set: new repair order (repairer); general outgoing mail; driver information; driver information – repair order delivered; expert – information on expert appointment; new repair order – opening new file → intermediary; new repair order – repairer follow-up; invoice – no expert report/approval; invoice – amount incorrect |
| Document | id, case_id (nullable for shared documents), file_name, size, mime_type, category (claim_form, photo, estimate, expert_report, invoice, repair_order, purchase_order, generated, other), storage_path |

### 1.12 Supporting objects

| Object | Fields |
| --- | --- |
| User | id, username, full_name, email, signature |
| Task | id, title, category (my_tasks, repairer_dealer, fleet_insurer, supplier, broker), due_date, assignee_user_id, case_id, done |
| StatusHistory | id, case_id, from_status, to_status, changed_at, changed_by, automatic (boolean) |
| AuditLog | id, entity, entity_id, field, old_value, new_value, actor_type (user, system, agent), actor_id, at |
| Tag / CaseTag | id, name / case_id, tag_id |
| Lookups | on_hold_reason, no_repair_reason, liability, circumstances, part_catalog |

### 1.13 Intake and automation objects (phase-2 hooks)

| Object | Fields |
| --- | --- |
| InboundEmail | id, message_id, from, to, cc, subject, body_text, body_html, received_at, raw_storage_path, parse_status (new, linked, triage, converted, ignored), linked_case_id |
| InboundAttachment | id, inbound_email_id, file_name, mime_type, size, storage_path |
| IntakeDraft | id, source_email_id, proposed_fields (jsonb), field_confidence (jsonb), missing_fields (text[]), status (draft, in_review, accepted, rejected), case_id (after acceptance) |
| OutboundMessage | id, case_id, template_id, merge_data (jsonb), to, cc, subject, body, status (draft, approved, sent, failed), approved_by, sent_at |
| Event | id, type (case.created, status.changed, email.received, quote.validated, message.sent), case_id, payload (jsonb), created_at, delivered (boolean) |
| ApiClient | id, name, scopes (text[]), key_hash, active |

## 2. Case lifecycle

Users can set any status manually from the status dropdown. The application sets the status automatically in one place: validating a quote (BR-03). The diagram shows the standard path; statuses without arrows (intake, client follow-up, delay) are set manually when they apply.

```mermaid
stateDiagram-v2
    direction TB
    ClientAssignment: Client assignment
    Intake: Intake - first contact
    FU_Client: File follow-up - client
    FU_Repairer: File follow-up - repairer
    FU_Broker: File follow-up - broker/insurer
    FU_Expert: File follow-up - expert
    FU_ReportOK: File follow-up - repairer (expert report OK)
    FU_Delay: File follow-up - delay
    Inv_Other: Invoicing - other
    Inv_OK: Invoicing - OK
    Closed: Closed

    [*] --> ClientAssignment: case created
    ClientAssignment --> FU_Repairer: repair order and intake mails sent
    FU_Repairer --> FU_Broker: estimate entered and sent to broker
    FU_Broker --> FU_ReportOK: quote validated, approval without expert (automatic)
    FU_Broker --> FU_Expert: broker appoints expert
    FU_Expert --> FU_ReportOK: expert report validated (automatic)
    FU_Expert --> Closed: total loss
    FU_Broker --> Closed: no repair
    FU_Expert --> Closed: no repair
    FU_ReportOK --> Inv_Other: repairer invoice received
    Inv_Other --> Inv_OK: all documents present (BR-08)
    Inv_OK --> Closed: sales invoice number recorded
    Closed --> [*]
```

End-to-end flow:

```mermaid
flowchart TB
    A[Assignment e-mail<br/>broker / client / repairer] --> B[Create case<br/>header, vehicle, parties, damage]
    B --> C[Send repair order, driver mail,<br/>intermediary mail]
    C --> D[Receive estimate<br/>enter pre-calculation]
    D --> E[Send estimate to broker]
    E --> F{Broker decision}
    F -- approve --> G[Post-calculation<br/>validate: approval without expert]
    F -- appoint expert --> H[File follow-up - expert]
    H --> I{Expert report}
    I -- repair --> J[Post-calculation from report<br/>validate: on site / Smart Expertise]
    I -- total loss --> K[Record total loss]
    F -- no repair --> L[Notify repairer<br/>no repair + reason]
    G --> M[Repair by repairer]
    J --> M
    M --> N[Repairer invoice received]
    N --> O[Check documents<br/>Invoicing - other]
    O --> P[Sales invoice number recorded<br/>Invoicing - OK]
    P --> Q[Closed]
    K --> Q
    L --> Q
```

## 3. Sequence diagrams

### 3.1 Create a case

```mermaid
sequenceDiagram
    autonumber
    actor Broker as Broker / Client
    participant Intake as Intake mailbox
    actor Agent as Case handler
    participant UI as Go Smart CRM UI
    participant API as API / domain services
    participant DB as Database
    actor Rep as Repairer
    actor Drv as Driver

    Broker->>Intake: Assignment e-mail (refs, policy, vehicle, driver, photos)
    Intake->>API: inbound webhook
    API->>DB: store InboundEmail + attachments (no case number: triage)
    Agent->>UI: Inbox > Create case from e-mail
    UI->>API: createCase(client)
    API->>DB: next sequence for client code + year
    DB-->>API: ABC20260001
    API-->>UI: case opened, status = Client assignment
    Agent->>UI: complete header, vehicle, parties, damage, documents
    UI->>API: save
    API->>DB: upsert Vehicle, CaseParty, Damage, Documents, AuditLog
    Agent->>UI: send template "New repair order"
    UI->>API: render template + generate repair-order PDF
    API->>Rep: e-mail with PDF
    API->>DB: Communication (out) linked to case
    Agent->>UI: send driver and intermediary templates
    API->>Drv: Repair order delivered
    API->>Broker: Opening new file with case number
    Agent->>UI: set status = File follow-up - repairer
    UI->>API: changeStatus
    API->>DB: status, StatusHistory, Event
```

### 3.2 Create a quote

```mermaid
sequenceDiagram
    autonumber
    actor Rep as Repairer
    actor Agent as Case handler
    participant UI as Go Smart CRM UI
    participant API as API / domain services
    participant DB as Database
    actor Broker as Broker

    Rep->>API: Estimate e-mail with case number (auto-linked)
    Agent->>UI: Case > Quote > Pre-calculation
    loop per estimate line
        Agent->>UI: add line (category, sub-type, description, amount)
        UI->>UI: recalculate subtotals and total
    end
    Agent->>UI: set hourly rates, complete vehicle data
    UI->>API: save quote (version = pre_calculation)
    API->>DB: Quote + QuoteLines
    Agent->>UI: send estimate to broker
    API->>Broker: e-mail with estimate
    Agent->>UI: set status = File follow-up - broker/insurer
    API->>DB: StatusHistory, Event
```

### 3.3 Approve the quote, with or without an expert

```mermaid
sequenceDiagram
    autonumber
    actor Broker as Broker
    actor Exp as Expert
    actor Agent as Case handler
    participant UI as Go Smart CRM UI
    participant API as API / domain services
    participant DB as Database

    alt Approval without expert
        Broker->>Agent: approval e-mail
        Agent->>UI: Quote > Post-calculation > Copy from pre-calculation
    else Expert appointed
        Broker->>Agent: expert appointed
        Agent->>UI: Parties: add expert, status = File follow-up - expert
        Exp->>Agent: expert report PDF (repair)
        Agent->>UI: enter expert ref, upload report under Assessment
        Agent->>UI: Post-calculation: enter figures from report
    end
    Agent->>UI: Validate
    UI-->>Agent: dialog: assessment type, VAT applicable, approved amount, loss-of-use days
    Agent->>UI: confirm
    UI->>API: validateQuote(case, type, vat, days)
    API->>DB: Assessment with approved amount excl/incl VAT
    API->>DB: status = File follow-up - repairer (expert report OK), automatic
    API-->>UI: confirmation
```

### 3.4 Invoice and close a case

```mermaid
sequenceDiagram
    autonumber
    actor Rep as Repairer
    actor Agent as Case handler
    participant UI as Go Smart CRM UI
    participant API as API / domain services
    actor Acc as Accounting
    actor Client as Client (owner / fleet owner)

    Rep->>Agent: repair invoice (with agreed discount)
    Agent->>UI: Assessment: invoice received + date, upload invoice
    Agent->>UI: set status = Invoicing - other
    UI->>API: checkCompleteness(case)
    alt document missing or amount incorrect
        API-->>UI: missing items listed
        Agent->>Rep: template "Invoice - amount incorrect" or "no expert report/approval"
    else complete
        Agent->>UI: set status = Invoicing - OK
        Agent->>Acc: request sales invoice
        Acc->>Client: sales invoice to the owner / fleet owner party
        Acc->>API: e-mail with sales invoice number (auto-linked)
        Agent->>UI: record sales invoice number, set status = Closed
    end
```

### 3.5 No repair

```mermaid
sequenceDiagram
    autonumber
    actor Broker as Broker
    actor Agent as Case handler
    participant UI as Go Smart CRM UI
    actor Rep as Repairer

    Broker->>Agent: "No repair" decision (e-mail stored on case)
    Agent->>Rep: notify immediately: do not start the repair
    Agent->>UI: Assessment: tick No repair, select reason
    Agent->>UI: set status = Closed
```

## 4. Solution architecture

```mermaid
flowchart TB
    subgraph Users["Internal users"]
        U1[Case handlers]
        U2[Case managers]
    end
    subgraph Ext["External parties (e-mail)"]
        E1[Brokers / insurers]
        E2[Experts]
        E3[Repairer network]
        E4[Clients and drivers]
        E5[Accounting]
    end
    subgraph App["Go Smart CRM"]
        UI[Web UI<br/>Next.js, Tailwind, shadcn/ui]
        API[API / domain services<br/>case numbering, status engine, quotes,<br/>completeness, templates, PDF]
        DB[(PostgreSQL<br/>Supabase)]
        ST[(File storage<br/>Supabase Storage)]
        EV[Event table + webhooks]
    end
    OUT[Outbound e-mail provider]
    IN[Inbound e-mail webhook<br/>intake address]
    FUT[Phase 2: AI agents, MCP server,<br/>Copilot / Power Automate]

    U1 & U2 --> UI --> API
    API --> DB
    API --> ST
    API --> EV
    API --> OUT --> E1 & E2 & E3 & E4
    E1 & E2 & E3 & E4 & E5 --> IN --> API
    EV -. future .-> FUT
    FUT -. drafts only, scoped API .-> API
```

| Component | Responsibility |
| --- | --- |
| Web UI | Left menu (Home; CRM: Dashboard, Accounts, Contacts, Tasks, Leads, Notes, Surveys; Damage claims: Cases, Inbox; Repairs: Dashboard, Network, Cases; Documents). Case screen with tabs: Case, Vehicle, Parties, Damage, Quote, Assessment, Communications, Documents, History. Save / Close buttons; warning marker on incomplete tabs |
| API / domain services | Case numbering, status engine (manual changes + automatic transition BR-03), quote totals and validation, completeness checks (BR-08), template rendering and repair-order PDF, inbound e-mail matching (BR-10) |
| Database | All objects in section 1, with row-level security |
| File storage | Photos, PDFs, raw e-mails, generated documents |
| Event table + webhooks | case.created, status.changed, email.received, quote.validated, message.sent, for future integrations |
| Outbound e-mail | Sends templated e-mails and records them as Communications |
| Inbound e-mail webhook | Receives e-mails sent or forwarded to the intake address, stores them as InboundEmail, links them by case number or routes them to the Inbox |
