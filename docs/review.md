# Final review – requirements and demo script

Reviewed on 2026-11-06 against `docs/requirements.md` (use cases in section 4, business rules in section 6) and the demo script in `docs/plan.md` section 5. The review ran in autopilot: the small gaps found were fixed at once (marked **Fixed**). Deviations agreed or assumed earlier are listed with their decision (D-…) or open question (Q-…) in `docs/decisions.md`.

## Use cases

| ID | Status | Where / what is missing |
| --- | --- | --- |
| UC-01 Log in | Deviation | E-mail address and password, not a username (agreed in iteration 0). |
| UC-02 View dashboard | Done, one placeholder | Dashboard: open tasks per category, new cases per month with the average and the trend. The lead-generation chart is a placeholder because Leads are a placeholder page (D-075). |
| UC-03 Create task | Done | Tasks page: categories, "All tasks", New task, mark as done (D-074). |
| UC-04 Open cases per client | Done | Client tiles on the case list. |
| UC-05 Search cases | Done | Free text: case number, plate (normalised), client, references. |
| UC-06 Filter case list | Done | Status, client, repairer and dates, with reset. |
| UC-07 Register assignment | Done | Case header fields; the assignment e-mail arrives in the Inbox; attachments become documents. |
| UC-08 Create case | Done | BR-01 numbering; also "Create case from e-mail". |
| UC-09 Maintain case header | Done | Case tab. |
| UC-10 Maintain vehicle | Done | Vehicle tab, including searching and linking an existing vehicle. |
| UC-11 Assign parties | Done | Parties tab. |
| UC-12 Record damage | Done | Damage tab; claim form and photos on Documents. |
| UC-13 Send repair order | Done | Template "New repair order" with the generated repair-order PDF. |
| UC-14 Notify driver | Done | Template "Driver information – repair order delivered". |
| UC-15 Notify intermediary | Done | Template; the compose screen reminds you to set "File follow-up – repairer" (a manual status change). |
| UC-16 Intake with minimal data | Done | Only the client is required. |
| UC-17 Client-specific references | Done | VDA/PO with the BR-11 marker. |
| UC-18 Enter pre-calculation | Done | Quote tab. |
| UC-19 Update vehicle data from the estimate | Done | A note on the Quote tab lists the missing vehicle data, with a link. |
| UC-20 Send estimate to broker | **Fixed** | Added "E-mail the estimate to the broker" on the Quote tab: the general template, addressed to the intermediary, with the estimate document attachable. Then "Mark as sent to broker" and the status (manual). |
| UC-21 Copy pre- to post-calculation | Done | |
| UC-22 Validate quote | Done | Validate dialog with the automatic status (BR-03). |
| UC-23 Register expert appointment | Done | Expert party, "Send assessment order" (template), status set manually. |
| UC-24 Process expert report | Done | Report under Assessment; figures in the post-calculation; Smart Expertise or On site (BR-04). |
| UC-25 Report matches the case | Done | BR-06 confirmation in the Validate dialog. Requesting a separate case per damage is a manual step. |
| UC-26 Record total loss | Done | |
| UC-27 Cancel repair | Done | Reason, "repairer notified" confirmation, closes the case. |
| UC-28 Put case on hold | Done | |
| UC-29 Register repairer invoice | Done | Assessment tab, with the two invoice templates (D-070). |
| UC-30 Check case completeness | Done | Completeness rules; checklist; BR-08 guard (D-071, D-072). |
| UC-31 Record sales invoice | Done | Closes the case (D-073). |
| UC-32 Show invoicing conditions | Done | Printed on the repair order (D-065). |
| UC-33 Send e-mail from template | Deviation | Everything except rich text: the body is plain text (D-064, Q-023). |
| UC-34 Capture inbound e-mail | Done | Webhook, BR-10 matching, Inbox, .eml upload. |
| UC-35 Log phone call / other | Done | Communications tab: filters and processed flag. |
| UC-36 Manage documents | Done | Case documents and the central Documents page. |
| UC-37 View change history | Done | History tab, including invoices and drafts from API clients. Communications are not in it (Q-028). |
| UC-38 Manage accounts and contacts | Done | |

## Business rules

| ID | Status | Where / what is missing |
| --- | --- | --- |
| BR-01 | Done | `case-number.ts`, with a database backstop. |
| BR-02 | Partial | The client is the owner/fleet owner and invoice party; one per case. Checking the right legal entity (for example the driver's e-mail domain) remains the user's judgement; there is no automatic check (Q-034). |
| BR-03 | Done | The only automatic status change, shown as System in the History. |
| BR-04 | Done | Validate dialog. |
| BR-05 | Done | Loss-of-use days in the Validate dialog. |
| BR-06 | Done | Confirmation in the Validate dialog. |
| BR-07 | Done | Reason, confirmation that the repairer was notified, closed. |
| BR-08 | Done | Status engine guard and checklist. |
| BR-09 | Done | Discount and conditions per repairer; on the repair order; the expected invoice amount. |
| BR-10 | Done | Subject matching only. |
| BR-11 | Done | Marker and note; the purchase order is uploaded under Assessment. |
| BR-12 | Done | Outbound: "Also log on cases"; inbound: several case numbers in the subject. |
| BR-13 | Done | Markers for BR-11 and, while invoicing, BR-08. |

## Other findings

| Finding | Status |
| --- | --- |
| design.md section 4 lists "Home" in the menu | Deviation: the Dashboard is the home page (Q-035). |
| E-mail is not delivered without a Postmark token | By design (D-056). Production needs `POSTMARK_SERVER_TOKEN` and a confirmed sender (README, "E-mail (Postmark)"). |
| Deployment to Vercel | Prepared, done by the product owner (D-013). E-mail, the API and cron need the extra environment variables in the README. |

## Demo script

`e2e/demo.spec.ts` runs the eight steps of plan.md section 5 with the sample e-mails in `docs/demo/`:

1. The broker e-mail arrives through the webhook and appears in the Inbox.
2. "Create case from e-mail" for Demo Fleet BV gives DEM20260001 on a fresh database. The test fills the vehicle, parties and damage and uploads a photo.
3. It sends the repair order with the PDF, the driver e-mail and the intermediary e-mail, then sets "File follow-up – repairer".
4. The repairer's reply is linked to the case automatically.
5. It enters the estimate, e-mails it to the broker, marks it as sent and sets "File follow-up – broker/insurer".
6. It copies the estimate and validates as "Approval without expert"; the status changes automatically.
7. It registers the repairer invoice (€870.00 = €1,000 minus 13%), sets "Invoicing – OK" after the completeness check, and records the sales invoice number, which closes the case.
8. The dashboard shows open tasks, the new-cases trend and the phase-2 tables.

The test removes its case afterwards, so DEM20260001 stays free for the live demo.
