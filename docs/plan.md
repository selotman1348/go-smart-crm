# Go Smart CRM – Build Plan

## 1. Goal

Build a working version 1 of Go Smart CRM for demonstration. It covers the full case lifecycle from `requirements.md`: intake (including receiving data by e-mail), case management, quotes and approval, communication, invoicing and closure. The data model, lifecycle, sequences and architecture are defined in `design.md`.

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Web UI | Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui |
| API / domain services | Next.js route handlers / server actions with a typed service layer in `src/domain/`; OpenAPI description in `docs/api.md` |
| Data | Supabase: PostgreSQL (migrations), Auth, Storage |
| E-mail | Transactional e-mail provider for outbound mail; inbound parsing webhook posting to `/api/inbound-email` |
| Tests | Vitest (unit), Playwright (end-to-end) |
| Hosting | Vercel |

All database access goes through a data-access layer in `src/domain/` (repositories). UI components never call the database directly, so the data platform can be replaced later without rewriting screens.

### 2.1 E-mail intake (version 1, no AI)

1. An e-mail is sent or forwarded to the intake address.
2. The inbound webhook posts the message (headers, body, attachments) to `/api/inbound-email`.
3. The API stores it as `InboundEmail`, with its attachments in Storage.
4. If the subject contains a case number (pattern: 2–4 capital letters + 4-digit year + 4-digit sequence), the API creates a Communication on that case (BR-10). Otherwise the e-mail goes to the Inbox, with the actions "Create case from e-mail" and "Link to case".
5. "Create case from e-mail" opens the new-case form with the e-mail shown side by side, and creates an empty `IntakeDraft` linked to the e-mail.

For local development, an "Upload .eml" action in the Inbox feeds the same pipeline.

## 3. Scalability requirements for phase 2 (build the hooks now, no AI in version 1)

Two automation streams will be added later:

- **Customer interaction automation:** an AI agent reads Outlook/Gmail (MCP client, or Microsoft Copilot / Power Automate), extracts case data into a draft, flags missing data, and drafts e-mails to the customer.
- **Quotation automation:** AI generates a quote from data in the CRM; a human validates it before it is sent.

Principle: **AI only creates drafts; a human approves**, through the same API as the UI.

| Hook (version 1) | How it is used in version 1 | Phase 2 use |
| --- | --- | --- |
| `InboundEmail` + `InboundAttachment` | Inbox and auto-linking | Agents post e-mails here |
| `IntakeDraft` (proposed fields, confidence, missing fields, status) | Created empty by "Create case from e-mail" | AI fills it; a reviewer accepts it into a Case |
| Completeness rules per client and stage (intake, quote, invoicing) | Warning markers on tabs (BR-13), blocking check BR-08 | Drives "missing data" e-mails to the customer |
| `OutboundMessage` (draft → approved → sent) | Template e-mails rendered as drafts; user sends | AI drafts e-mails; human approves |
| Quote `origin`, `status`, `generated_by`, `model_version`, `rationale`; line `source_refs` | All quotes manual | AI proposes a quote with status `pending_review`; human validates |
| Reference data: hourly rates per repairer, part catalog, quote-line history | Filled from manual quotes | Data for AI quote suggestions |
| `Event` table + outbound webhooks | Dashboard trends, history | Triggers for agents and flows |
| `ApiClient` with scopes (read cases, create drafts; no final status changes) | Not used by the UI | MCP server tools and agents use scoped keys |
| `AuditLog` with actor type (user, system, agent) | History tab | Traceability of AI actions |

## 4. Iterations

Each iteration ends with a working, testable increment. Work on one iteration per session.

| # | Iteration | Scope | Done when |
| --- | --- | --- | --- |
| 0 | Setup | Next.js app, Supabase project, Auth (login), CI scripts, `.env.example` | Login works, empty dashboard deployed |
| 1 | Data model and master data | Complete schema for `design.md` section 1 (including phase-2 hook tables), migrations, lookups, seed data with fictitious accounts, contacts, vehicles, users and 10 cases in different statuses. Accounts and Contacts screens (UC-01, UC-38) | Seed loads on a fresh database; accounts and contacts can be browsed and edited |
| 2 | Case management | Case list with search, filters and client tiles; create case with numbering; case screen with tabs Case, Vehicle, Parties, Damage, Documents, History; status engine with StatusHistory, Event and AuditLog; on hold; tags (UC-04 to UC-12, UC-16, UC-17, UC-28, UC-36, UC-37) | A case can be created and completed end to end, and its status changed with history |
| 3 | Quotes and assessment | Pre- and post-calculation with categories, sub-types and subtotals; copy pre → post; Validate dialog with automatic status (BR-03); expert assessment; no repair; total loss (UC-18 to UC-27) | Estimate → approval → automatic status, with and without expert |
| 4 | Communication and e-mail intake | E-mail templates with merge fields; repair-order PDF; sending through the provider; communication log with filters and processed flag; inbound webhook, matching, Inbox, "Create case from e-mail", "Link to case", ".eml upload" (UC-13 to UC-15, UC-33 to UC-35) | A forwarded e-mail appears on the right case, or in the Inbox |
| 5 | Invoicing, dashboard and hooks | Repairer invoice, completeness check (BR-08), sales invoice number, closing; dashboard with open tasks by category and trend charts; tasks; remaining phase-2 hooks (OutboundMessage drafts, ApiClient scopes, event webhooks) documented in `docs/api.md`; placeholder pages for Leads, Notes, Surveys and Repairs (UC-02, UC-03, UC-29 to UC-32) | The demo script in section 5 runs end to end |

## 5. Demo script

1. Forward a sample broker assignment e-mail to the intake address. It appears in the Inbox.
2. "Create case from e-mail": case number DEM20260001 is generated. Fill in the vehicle, parties and damage, and upload photos.
3. Send the repair order (with PDF), the driver e-mail and the intermediary e-mail. Set status "File follow-up – repairer".
4. The repairer replies with the case number in the subject. The reply is linked to the case automatically.
5. Enter the estimate as a pre-calculation and send it to the broker. Set status "File follow-up – broker/insurer".
6. Copy to the post-calculation and validate as "approval without expert". The status changes automatically to "File follow-up – repairer (expert report OK)".
7. Register the repairer invoice. The completeness check passes. Set "Invoicing – OK", record the sales invoice number and close the case.
8. Dashboard: open tasks and the new-cases trend. Show the draft tables ready for phase 2.

## 6. Out of scope for version 1

- AI extraction, AI e-mail drafting and AI quote generation (phase 2; hooks only).
- Detailed Leads, Notes, Surveys and Repairs functionality (placeholder pages).
- Integration with accounting; the sales invoice number is entered manually.
