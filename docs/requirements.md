# Go Smart CRM – Requirements

## 1. Purpose

Go Smart CRM is a case-centric CRM for managing vehicle damage repairs. A damage repair company receives repair assignments from brokers and fleet clients. It sends repair orders to a network of partner repairers (body shops), follows up on estimates, broker approvals and expert assessments, and closes each case once the repair has been invoiced.

The central record is the **Case** (damage claim file). Each case has one vehicle and one client, and is linked to the parties involved (broker, insurer, expert, repairer, driver and others). Each case holds the damage details, quotes, assessment, communications and documents. One status field drives the work queue.

Version 1 delivers a working application for demonstration, including receiving case data by e-mail. AI features are out of scope for version 1, but the design must support them later (see `plan.md` section 3).

## 2. Actors

| Actor | Type | Role |
| --- | --- | --- |
| Case handler | Internal user | Creates and follows up cases, enters quotes, sends e-mails, sets the status |
| Case manager | Internal user | Owner of a case, shown in the case list |
| Accounting | Internal (outside the application) | Creates the sales invoice to the client; the invoice number is reported back by e-mail |
| Client / fleet owner | External organisation | Owns the vehicles and is invoiced (e.g. a car-rental or fleet company) |
| Driver | External person | Uses the vehicle, receives status e-mails and takes the car to the repairer |
| Broker / intermediary | External organisation | Sends the assignment, approves the quote or appoints an expert, may decide "no repair" |
| Insurer | External organisation | Carries the risk (policy) |
| Leasing company | External organisation | Lessor of the vehicle |
| Expert | External organisation | Assesses the damage on site or remotely and issues a report (repair or total loss) |
| Repairer | External organisation (network) | Receives the repair order, sends an estimate, repairs the vehicle and invoices the company |
| Third party | External | Other party in the accident |
| Insured / tenant | External person | Policy holder or renter |
| Supplier | External organisation | Category used for tasks |

Internal users log in to the application. External parties interact only by e-mail and documents. They are stored as Accounts (organisations) and Contacts (people), and given a role on each case.

## 3. Business processes

| ID | Process | Trigger | Outcome |
| --- | --- | --- | --- |
| BP-01 | Access and work queue | User logs in | Dashboard with open tasks; case list filtered by status and client |
| BP-02 | Case intake | Assignment e-mail from a broker, client or repairer | Case created, repair order sent, status "File follow-up – repairer" |
| BP-03 | Estimate (quote) capture | Repairer sends an estimate | Pre-calculation entered and sent to the broker; status "File follow-up – broker/insurer" |
| BP-04 | Quote approval without expert | Broker approval e-mail | Post-calculation validated; status "File follow-up – repairer (expert report OK)" |
| BP-05 | Expert assessment | Broker appoints an expert / expert report received | Expert reference, figures and loss-of-use days validated |
| BP-06 | Total loss | Expert report "total loss" | Total-loss figures recorded; case closed |
| BP-07 | No repair | Broker decides "no repair" | Repairer notified; case closed with a reason |
| BP-08 | Invoicing and closure | Repairer invoice received | Documents checked, sales invoice reference recorded, case closed |
| BP-09 | Communication capture | Any e-mail in or out, phone call, other contact | Communication logged on the case, attachments stored |
| BP-10 | CRM records | Day-to-day relationship work | Contacts, accounts, tasks |

## 4. Use cases

### BP-01 Access and work queue

| UC | Use case | Description |
| --- | --- | --- |
| UC-01 | Log in | Username and password |
| UC-02 | View dashboard | Open tasks by category (my tasks, repairer/dealer, fleet/insurer, supplier, broker) with counters. Charts: new cases per period with trend and average; lead generation per period |
| UC-03 | Create task | "New" task, filtered by category; "all tasks" view |
| UC-04 | View open cases per client | Tiles showing the number of open cases per client, plus the total |
| UC-05 | Search cases | Free-text search on case number, licence plate, etc. One plate may return several cases |
| UC-06 | Filter case list | By status, client, repairer, assignment date, damage date, completion date and creation date; reset filters. List columns: licence plate, case number, client, manager, status, damage date, assignment date |

### BP-02 Case intake

| UC | Use case | Description |
| --- | --- | --- |
| UC-07 | Register assignment | Read the incoming assignment: broker/insurer reference, policy number, cover type, vehicle, driver, expert, recoverable VAT %, attachments (claim form, photos) |
| UC-08 | Create case | Choose the client; the case number is generated as client code + year + sequence |
| UC-09 | Maintain case header | Insurer ref., broker ref., expert ref., leasing ref., VAT liable %, deductible, assignment / completion / collected / delivered dates, appointment dates (estimate, repair), vehicle in / ready / client notified / vehicle out dates, on hold + reason, assigned to, tags |
| UC-10 | Maintain vehicle | Licence plate, chassis number (VIN), first registration date, make, model, model year, type designation, category (e.g. electric), colour, paint type |
| UC-11 | Assign parties | Per role, pick an account or contact: owner/fleet owner (the invoice party), leasing company, driver, insured/tenant, insurer, intermediary, third party, expert, repairer |
| UC-12 | Record damage | Date, mileage in/out, damage location address, cause, liability, circumstances, damaged-parts checklist, extra information; upload the claim form and photos |
| UC-13 | Send repair order to repairer | Template "New repair order" with a generated repair-order PDF attached |
| UC-14 | Notify driver | Template "Driver information – repair order delivered" |
| UC-15 | Notify intermediary | Template "New repair order – opening new file → intermediary"; then set status "File follow-up – repairer" |
| UC-16 | Intake with minimal data | The repairer sends minimal details (damage appraisal number, plate, model, VIN), a copy of the estimate or the client's approval; the case is created with the data available |
| UC-17 | Record client-specific references | For clients that require them (e.g. a car-rental client), record the Vehicle Damage Appraisal (VDA) number and the Purchase Order (PO) number |

### BP-03 / BP-04 Quote

| UC | Use case | Description |
| --- | --- | --- |
| UC-18 | Enter pre-calculation | Quote lines: category, sub-type, description, amount. Hourly rates for paintwork and (dis)assembly. Subtotals per category and total |
| UC-19 | Update vehicle data from the estimate | Complete missing vehicle details (type, VIN, …) from the estimate |
| UC-20 | Send estimate to broker | E-mail with the estimate; then set status "File follow-up – broker/insurer" |
| UC-21 | Copy pre- to post-calculation | One action copies all lines |
| UC-22 | Validate quote | Dialog: assessment type (none / on site / Smart Expertise / approval without expert), VAT applicable, approved amount (excl. and incl. VAT), loss-of-use days. On confirm the status changes automatically to "File follow-up – repairer (expert report OK)" |

### BP-05 / BP-06 Expert assessment and total loss

| UC | Use case | Description |
| --- | --- | --- |
| UC-23 | Register expert appointment | Expert in Parties, template "Expert – information on expert appointment", action "Send assessment order"; set status "File follow-up – expert" |
| UC-24 | Process expert report | Store the report PDF under Assessment; enter the expert reference; complete vehicle details; enter the figures in the post-calculation; set the assessment type (a remote assessment = Smart Expertise, otherwise On site); enter the repair days as loss-of-use days; validate |
| UC-25 | Check the report matches the case | Compare the report's remarks with the case damage. If one vehicle has several damages, each needs its own case (requested from the intermediary) |
| UC-26 | Record total loss | Record vehicle value before the incident, deduction for previous damage, accessories, wreck value and total damage amount; close the case |

### BP-07 No repair

| UC | Use case | Description |
| --- | --- | --- |
| UC-27 | Cancel repair | Store the broker e-mail, notify the repairer immediately, tick "No repair" with a reason, set status "Closed" |
| UC-28 | Put case on hold | On-hold flag with a reason |

### BP-08 Invoicing and closure

| UC | Use case | Description |
| --- | --- | --- |
| UC-29 | Register repairer invoice | Invoice received + date, upload the invoice. Templates "Invoice – no expert report/approval" and "Invoice – amount incorrect". Set status "Invoicing – other" |
| UC-30 | Check case completeness | Estimate, approval or expert report, and repairer invoice must be present before "Invoicing – OK" |
| UC-31 | Record sales invoice | The sales invoice number (from accounting) is recorded on the case; set status "Closed" |
| UC-32 | Show invoicing conditions | The invoicing conditions for repairers are printed on the repair order |

### BP-09 Communication and documents

| UC | Use case | Description |
| --- | --- | --- |
| UC-33 | Send e-mail from template | Choose template and language; To/Cc/Bcc; rich-text body; generated and uploaded attachments; the message is linked to one or more cases |
| UC-34 | Capture inbound e-mail | E-mails sent or forwarded to the intake address are stored. When the subject contains a case number they are linked to that case automatically; otherwise they appear in the Inbox for triage |
| UC-35 | Log phone call / other | "Add communication"; filter the log by e-mails in, e-mails out, phone calls, other; mark as processed |
| UC-36 | Manage documents | Upload documents per case; central Documents module for shared documents (e.g. the repair-order template) |
| UC-37 | View change history | History tab with all changes on the case |

### BP-10 CRM records

| UC | Use case | Description |
| --- | --- | --- |
| UC-38 | Manage accounts and contacts | Create and edit organisations (typed) and their contacts |

The current menu also contains Leads, Notes, Surveys and a Repairs section (dashboard, network, cases per repairer). Their detailed behaviour is not specified. In version 1 they are placeholder pages.

## 5. Case status values

| Code | Label |
| --- | --- |
| client_assignment | Client assignment |
| intake_first_contact | Intake – first contact |
| followup_client | File follow-up – client |
| followup_broker_insurer | File follow-up – broker/insurer |
| followup_repairer | File follow-up – repairer |
| followup_expert | File follow-up – expert |
| followup_repairer_report_ok | File follow-up – repairer (expert report OK) |
| followup_delay | File follow-up – delay |
| invoicing_other | Invoicing – other |
| invoicing_ok | Invoicing – OK |
| closed | Closed |

## 6. Business rules

| ID | Rule |
| --- | --- |
| BR-01 | Case number = client code + 4-digit year + sequence per client per year (e.g. ABC20250115). |
| BR-02 | The Owner/Fleet owner party is the invoice party. It must be the correct legal entity, also within groups of companies; check all communication (e.g. the driver's e-mail domain) to determine it. |
| BR-03 | Validating a quote sets the status to "File follow-up – repairer (expert report OK)". |
| BR-04 | An expert report marked as a remote assessment means assessment type Smart Expertise; otherwise On site. |
| BR-05 | The repair duration stated by the expert is entered as loss-of-use days. |
| BR-06 | An expert report must be stored on the case whose damage matches the report's remarks. |
| BR-07 | "No repair" requires a reason, an immediate notification to the repairer and status "Closed". |
| BR-08 | Status "Invoicing – OK" is only allowed when the estimate, the approval or expert report, and the repairer invoice are all present; until then use "Invoicing – other". |
| BR-09 | Repairers invoice the company with the agreed total discount (e.g. 13% = 8% for the client + 5% commission), sent to the company's invoicing e-mail address. These conditions are configurable and printed on the repair order. |
| BR-10 | Inbound e-mails are linked to a case automatically only when the subject contains the case number. |
| BR-11 | For clients that require them, the VDA number and PO number are mandatory references; the client's purchase-order document is stored under Assessment. |
| BR-12 | One communication can be linked to several cases. |
| BR-13 | Tabs with missing required information show a warning marker. |
