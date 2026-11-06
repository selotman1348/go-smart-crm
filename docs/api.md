# Go Smart CRM – API and hooks

This document covers the interfaces outside the user interface:

- the **agent API**: what external agents (phase 2: AI agents, an MCP server, Copilot / Power Automate) may do
- the **inbound e-mail webhook**
- the **event webhooks**

All of them follow plan.md section 3: **agents only create drafts; a human approves.** No API call changes a case status or sends an e-mail, whatever the key's scopes. Those actions exist only in the UI, for signed-in users.

## Authentication and scopes

An API client is a row in `api_client` with a name, scopes and the SHA-256 hash of its key. The key itself is never stored. To create one:

```sh
npm run api:key -- "Intake agent" cases:read,drafts:write
```

The script prints the key once (`gsk_…`). Send it with every call:

```
Authorization: Bearer gsk_…
```

| Scope | Allows |
| --- | --- |
| `cases:read` | Reading cases: `GET /api/v1/cases`, `GET /api/v1/cases/{caseNumber}` |
| `drafts:write` | Creating drafts: e-mail drafts on a case, and proposed case data (intake drafts) for an e-mail in the Inbox |

To deactivate a client, set `active = false` (Supabase dashboard). A missing or unknown key gets `401`; a key without the scope gets `403`.

Writes by an API client are recorded in `audit_log` with `actor_type = agent` and the client's id as `actor_id`. The case's History tab shows them as "API client".

## OpenAPI description

```yaml
openapi: 3.1.0
info:
  title: Go Smart CRM agent API
  version: 1.0.0
  description: >
    Read cases and create drafts. Agents never change a status or send an
    e-mail; a user reviews every draft (plan.md section 3).
servers:
  - url: https://{host}/api/v1
    variables:
      host:
        default: go-smart-crm.vercel.app
security:
  - apiKey: []
components:
  securitySchemes:
    apiKey:
      type: http
      scheme: bearer
      description: An API key "gsk_…" created with npm run api:key.
  schemas:
    CaseStatus:
      type: string
      enum:
        - client_assignment
        - intake_first_contact
        - followup_client
        - followup_broker_insurer
        - followup_repairer
        - followup_expert
        - followup_repairer_report_ok
        - followup_delay
        - invoicing_other
        - invoicing_ok
        - closed
    CaseSummary:
      type: object
      required: [caseNumber, status, createdAt]
      properties:
        caseNumber: { type: string, example: DEM20260001, description: "Client code + year + sequence (BR-01)" }
        status: { $ref: "#/components/schemas/CaseStatus" }
        client: { type: [string, "null"], example: Demo Fleet BV }
        licencePlate: { type: [string, "null"], example: 2-DMO-001 }
        createdAt: { type: string, format: date-time }
    Case:
      allOf:
        - $ref: "#/components/schemas/CaseSummary"
        - type: object
          properties:
            insurerRef: { type: [string, "null"] }
            brokerRef: { type: [string, "null"] }
            policyNumber: { type: [string, "null"] }
            parties:
              type: array
              items:
                type: object
                properties:
                  role: { type: string, example: repairer }
                  account: { type: [string, "null"] }
                  contact: { type: [string, "null"] }
    EmailDraft:
      type: object
      required: [subject, body]
      properties:
        to:
          description: Addresses, as a list or comma-separated; "Name <address>" is allowed.
          oneOf:
            - type: string
            - type: array
              items: { type: string }
        cc:
          oneOf:
            - type: string
            - type: array
              items: { type: string }
        subject: { type: string, maxLength: 300 }
        body: { type: string, maxLength: 50000, description: Plain text. }
        templateCode: { type: string, example: general, description: Optional; one of the e-mail templates. }
        language: { type: string, enum: [en, nl], default: en }
    IntakeProposal:
      type: object
      required: [proposedFields]
      properties:
        proposedFields:
          type: object
          additionalProperties: true
          example: { clientCode: DEM, licencePlate: 2-DMO-001, brokerRef: HLB-26-0420 }
        fieldConfidence:
          type: object
          additionalProperties: { type: number, minimum: 0, maximum: 1 }
        missingFields:
          type: array
          items: { type: string }
          example: [policyNumber]
    Error:
      type: object
      properties:
        error: { type: string }
  responses:
    Unauthorized:
      description: No valid API key.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    Forbidden:
      description: The key lacks the scope.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    NotFound:
      description: No such case or e-mail.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
paths:
  /cases:
    get:
      summary: Recent cases (scope cases:read)
      parameters:
        - { name: status, in: query, schema: { $ref: "#/components/schemas/CaseStatus" } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
      responses:
        "200":
          description: Newest first.
          content:
            application/json:
              schema:
                type: object
                properties:
                  cases: { type: array, items: { $ref: "#/components/schemas/CaseSummary" } }
        "400": { description: Unknown status. }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
  /cases/{caseNumber}:
    get:
      summary: One case (scope cases:read)
      parameters:
        - { name: caseNumber, in: path, required: true, schema: { type: string } }
      responses:
        "200":
          description: The case.
          content:
            application/json:
              schema:
                type: object
                properties:
                  case: { $ref: "#/components/schemas/Case" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
  /cases/{caseNumber}/email-drafts:
    post:
      summary: An e-mail draft on the case (scope drafts:write)
      description: >
        Stored as an outbound message with status "draft". It appears under
        Drafts on the case's Communications tab; a user checks it and sends it.
      parameters:
        - { name: caseNumber, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/EmailDraft" }
      responses:
        "201":
          description: Draft created.
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string, format: uuid }
                  status: { type: string, enum: [draft] }
        "400": { description: Invalid draft (addresses, subject, body or template). }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
  /inbound-emails/{id}/intake-draft:
    post:
      summary: Proposed case data for an e-mail in the Inbox (scope drafts:write)
      description: >
        Fills the e-mail's intake draft (status "in_review"). A user creates
        the case with "Create case from e-mail"; the draft is then accepted.
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/IntakeProposal" }
      responses:
        "201":
          description: Draft stored.
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string, format: uuid }
                  status: { type: string, enum: [in_review] }
        "400": { description: Invalid proposal. }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { description: The e-mail is no longer waiting for triage. }
```

## Inbound e-mail webhook

`POST /api/inbound-email` receives every e-mail sent or forwarded to the intake address (plan.md 2.1, UC-34). It is protected by HTTP Basic authentication: the password must be `INBOUND_EMAIL_SECRET`. With Postmark, the webhook URL is `https://postmark:<secret>@<host>/api/inbound-email`.

The webhook accepts two body formats:

- Postmark's inbound JSON (`FromFull`, `ToFull`, `CcFull`, `Subject`, `TextBody`, `HtmlBody`, `Date`, `Headers`, base64 `Attachments`)
- a raw message with `Content-Type: message/rfc822`

Processing:

1. The e-mail and its attachments are stored (bucket `inbound`, table `inbound_email`). An e-mail with a Message-ID that was stored before is not stored again.
2. If the subject contains the number of an existing case (2–4 capital letters and 8 digits, BR-10), the e-mail is logged on that case as a communication. Document-type attachments become case documents.
3. Otherwise the e-mail waits in the Inbox.
4. The event `email.received` is written.

Answers:

- `200` with `{ id, duplicate, linkedCaseNumbers }`
- `400` if the body is not an e-mail
- `401` without the secret
- `500` on a storage error, so the provider retries

## Event webhooks

Business events are written to the `event` table: `case.created`, `status.changed`, `email.received`, `quote.validated` and `message.sent`. When `EVENT_WEBHOOK_URL` and `EVENT_WEBHOOK_SECRET` are set, `GET /api/events/dispatch` posts undelivered events to that URL, oldest first, and marks each one `delivered` after a 2xx answer. Delivery stops at the first failure, so the order is kept; the next run retries.

The endpoint requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron calls it with that header, as configured in `vercel.json` (daily on the Hobby plan; more often on Pro).

Each request:

```
POST <EVENT_WEBHOOK_URL>
Content-Type: application/json
X-GoSmart-Event: status.changed
X-GoSmart-Delivery: <event id>
X-GoSmart-Signature: sha256=<HMAC-SHA256 of the raw body with EVENT_WEBHOOK_SECRET, hex>

{ "id": "…", "type": "status.changed", "caseId": "…", "payload": { "caseNumber": "DEM20260001", "from": "…", "to": "…", "automatic": false }, "createdAt": "…" }
```

Receivers verify the signature over the raw body, and use `X-GoSmart-Delivery` to ignore an event they have already received.

## Other hooks for phase 2

| Hook | Where |
| --- | --- |
| Completeness rules | `completeness_rule`. Rows per client and stage, with requirement keys from `src/domain/invoicing/completeness.ts`. The invoicing rules drive BR-08 and the warning markers (BR-13). |
| Quote origin and review | `quote.origin` (`ai` is reserved), `quote.status` `pending_review`, `generated_by`, `model_version`, `rationale`, and `quote_line.source_refs`. Version 1 enters quotes manually. |
| Reference data | Views `repairer_hourly_rate` and `quote_line_history`. |
