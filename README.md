# Go Smart CRM

A case-centric CRM for vehicle damage repairs. It manages cases between clients, brokers and insurers, experts, and a network of repairers.

- Requirements: [docs/requirements.md](docs/requirements.md)
- Design (data model, lifecycle, architecture): [docs/design.md](docs/design.md)
- Build plan and iterations: [docs/plan.md](docs/plan.md)
- Decisions and open questions: [docs/decisions.md](docs/decisions.md)

**Stack:** Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4 and shadcn/ui, Supabase (PostgreSQL, Auth, Storage), Vitest and Playwright.

## Getting started

Requirements: Node.js 24 or later, and a Supabase project.

1. **Install the dependencies**

   ```sh
   npm install
   npx playwright install chromium   # browser for the end-to-end tests
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard). Then, in the dashboard:
   - Go to **Authentication > Sign In / Providers** and turn **off** "Allow new users to sign up". Only internal users sign in, and they are created by the seed script or an admin.
   - Go to **Project Settings > API Keys** and copy the project URL, the **publishable** key and a **secret** key.
   - Go to **Account > Access Tokens** and create a token for the Supabase CLI. If you can, limit it to this project with database read/write and projects read.

3. **Configure the environment**

   ```sh
   cp .env.example .env.local
   ```

   Fill in `.env.local`, which git never tracks:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `SUPABASE_ACCESS_TOKEN`: the CLI token
   - `SEED_USER_PASSWORD`: a password you choose for the fictitious users

4. **Create the schema, load the seed and start the app**

   ```sh
   npm run db:push   # applies supabase/migrations to the hosted project
   npm run db:seed   # fictitious users, accounts, contacts, vehicles and 10 cases
   npm run dev
   ```

   Open <http://localhost:3000> and sign in as `alex.morgan@gosmart.example`, with the password you set in `SEED_USER_PASSWORD`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint, including the rule that keeps Supabase out of UI code |
| `npm run typecheck` | Generate the route types and run `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright). They start `npm run dev` unless a server is already running |
| `npm run ci` | Lint, typecheck, unit tests and build |
| `npm run db:push` / `db:push:dry` | Apply new migrations to the hosted project, or only list them |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the hosted schema. Commit the result. CI typechecks the app against types generated from a fresh database |
| `npm run db:seed` | Load the seed data. Safe to repeat: existing rows are never overwritten |
| `npm run api:key -- "<name>" cases:read,drafts:write` | Create an API client for an agent and print its key once (`docs/api.md`) |
| `npm run db:start` / `db:stop` / `db:reset` | Optional local Supabase stack (needs Docker). CI uses it to test on a fresh database |

### Changing the schema

1. Add a new file to `supabase/migrations/`, named `<timestamp>_<description>.sql`. Never edit a migration that has already been applied.
2. Run `npm run db:push:dry`, then `npm run db:push`.
3. Run `npm run db:types` and commit the migration together with the types.

## Seed data

All seed data is fictitious (`scripts/seed/data.ts`). It uses Belgian formats with unissued plates (`9-xxx-000`), VAT numbers with wrong check digits, `000` phone numbers and `.example` e-mail addresses. It contains:

- **Users:** `alex.morgan`, `sam.taylor` and `lena.janssens` (all `@gosmart.example`), with the password from `SEED_USER_PASSWORD`.
- **18 accounts:**
  - a group of companies: Velora Mobility Group, with Velora Car Rental (VCR, requires VDA/PO) and Velora Fleet Services (VFS)
  - the demo client Demo Fleet (DEM)
  - brokers, insurers, experts, leasing companies, a supplier and a third party
  - 4 repairers, 3 of them in the network with a 13% discount
- **25 contacts** and **12 vehicles**.
- **10 cases in 10 different statuses**, with parties, damage, quotes, assessments, invoices, tags and full status history. DEM has no 2026 case, so the demo's first case is DEM20260001.

## What works so far

- **Login** (UC-01): e-mail address and password.
- **Dashboard** (UC-02): open tasks per category, new cases per month with the average and the trend, and what the phase-2 hook tables hold.
- **Tasks** (UC-03): all tasks or one category, new tasks (optionally for a case), mark as done.
- **Accounts and Contacts** (UC-38): browse, search, create and edit.
- **Cases:**
  - list with search, filters and client tiles (UC-04 to UC-06)
  - create a case with an automatic case number (UC-08, BR-01)
  - case screen tabs:
    - **Case:** header, VDA/PO references with BR-11 warning, on hold, tags
    - **Vehicle:** maintain the vehicle, or find an existing one and link it
    - **Parties**
    - **Damage:** details and damaged parts
    - **Quote:** pre- and post-calculation with categories, sub-types, live subtotals and total; mark as sent; copy pre to post; the Validate dialog, which changes the status automatically (UC-18 to UC-22, BR-03 to BR-06)
    - **Assessment:** expert and expert report, the validation summary, total loss and no repair, both closing the case (UC-23 to UC-27, BR-07); "Send assessment order"; invoicing: the repairer invoice with the expected amount after the agreed discount (BR-09), the completeness check (BR-08) and the sales invoice number, which closes the case (UC-29 to UC-31)
    - **Communications:** the log with filters (e-mails in/out, phone calls, other) and a processed flag; e-mails from templates in English or Dutch with merge fields, To/Cc/Bcc and attachments, including the generated repair-order PDF; logging phone calls (UC-13 to UC-15, UC-33, UC-35)
    - **Documents**
    - **History**
  - a status dropdown, handled by the status engine; "Invoicing – OK" only when the case is complete (BR-08), and tabs with missing information carry a marker (BR-13)
- **Inbox** (UC-34): e-mails sent or forwarded to the intake address arrive through the webhook `/api/inbound-email`. An e-mail whose subject contains a case number is logged on that case automatically, with its attachments (BR-10); the others wait in the Inbox, with "Create case from e-mail" and "Link to case". "Upload .eml" feeds a saved e-mail into the same pipeline; `docs/demo/` has two sample e-mails for the demo script.
- **Agent API and hooks** (`docs/api.md`): scoped API keys (`npm run api:key`) that read cases and create drafts only; event webhooks through `/api/events/dispatch`.
- **Placeholder pages:** Leads, Notes, Surveys and Repairs (dashboard, network, cases), as version 1 leaves them unspecified.
- **Documents** (UC-36): case documents and a central page for shared documents.
  - Files go straight from the browser to the private Storage bucket `documents`, which the migrations create.
  - Limits: 20 MB per file; PDF, images, Word, Excel, `.eml` and text.

The demo script (`docs/plan.md` section 5) runs end to end as `e2e/demo.spec.ts`; `docs/review.md` checks every use case and business rule.

Every change to a case is recorded in its History by a database trigger. Status changes go only through the status engine (`docs/decisions.md`, D-033 and D-034).

## Project layout

```
src/
  app/            Routes and UI. No database access here (ESLint enforces it)
  components/     Shared UI; components/ui/ holds the shadcn/ui components
  domain/         Business rules, repositories and services (auth, accounts, contacts, cases,
                  vehicles, parties, damage, quotes, assessment, invoicing, communications,
                  intake, tasks, dashboard, api, events, documents, history, lookups, users)
  lib/            Supabase client factories, generated database types, environment settings
  proxy.ts        Refreshes the session and redirects signed-out users
supabase/         Supabase CLI config and migrations
scripts/seed/     Seed data and loader
scripts/supabase-remote.ts   Runs CLI commands against the hosted project
e2e/              Playwright tests
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

1. **checks:** lint, typecheck, unit tests and build.
2. **e2e:** starts a fresh local Supabase on the runner (this also checks that the migrations apply cleanly), seeds it, builds the app and runs Playwright. It needs no repository secrets.

## Deploying to Vercel

The Hobby plan is for personal, non-commercial use only; a CRM used by a business needs Pro. Hobby runs cron jobs at most once a day, which is enough for `vercel.json` (daily at 06:00 UTC).

Generate each new secret in your own terminal, and paste it only into Vercel or Postmark:

```sh
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

1. Push the repository to GitHub.
2. In Vercel, click **Add New > Project** and import the repository. The framework preset is detected as Next.js, and the defaults need no changes.
3. Under **Environment Variables**, add (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with the same values as in `.env.local`.
   - `SUPABASE_SECRET_KEY` (the inbound webhook, the agent API and the event dispatcher use it) and `INBOUND_EMAIL_SECRET`, with the same values as in `.env.local`. Mark both **Sensitive**.
   - `CRON_SECRET`: a new secret, marked Sensitive. Vercel Cron sends it to `/api/events/dispatch`.
   - `COMPANY_NAME` and `INVOICING_EMAIL`: your company name and invoicing address, printed on the repair order.
   - `POSTMARK_SERVER_TOKEN` and `EMAIL_FROM`: see [E-mail (Postmark)](#e-mail-postmark). Without the token, e-mails are logged on the case but not delivered.
   - `EVENT_WEBHOOK_URL` and `EVENT_WEBHOOK_SECRET`: only if another system should receive the events (`docs/api.md`).

   `SUPABASE_ACCESS_TOKEN`, `SEED_USER_PASSWORD` and `E2E_USER_EMAIL` are for the CLI and the tests only; don't add them. Preview deployments use the same Supabase database as production.
4. Under **Settings > Build and Deployment**, check that **Node.js Version** is 24.x. Under **Settings > Functions**, set **Function Region** to the region closest to your Supabase project.
5. Click **Deploy**. After changing an environment variable later, redeploy (**Deployments > … > Redeploy**); a running deployment keeps the old values.
6. In the Supabase dashboard, go to **Authentication > URL Configuration**. Set **Site URL** to the Vercel production URL (for example `https://go-smart-crm.vercel.app`), and add `http://localhost:3000` under **Redirect URLs**.
7. Open the Vercel URL and sign in with a seeded user. You should see the dashboard. Under **Settings > Cron Jobs**, **Run** on `/api/events/dispatch` answers "No event webhook is configured" until `EVENT_WEBHOOK_URL` is set.

The hosted database holds the seed data, so on a public URL anyone who knows `SEED_USER_PASSWORD` can sign in. Make sure it is strong and not used anywhere else.

### E-mail (Postmark)

Receiving e-mail (inbound processing) needs the Pro or Platform plan; the free plan doesn't include it. Check [postmarkapp.com/pricing](https://postmarkapp.com/pricing) before choosing.

**Sending**

1. In Postmark, go to **Servers > Create server** and create a **Live** server.
2. Go to **Sender Signatures > Add Domain** and add your domain. Add the DKIM (TXT) and Return-Path (CNAME) records Postmark shows at your DNS provider, then click **Verify**.
3. Set `EMAIL_FROM` to an address on that domain, for example `Go Smart CRM <cases@yourdomain.com>`. The built-in default uses the fictitious `gosmart.example`, which Postmark can't send from.
4. Click **Request approval**. Until Postmark approves the account (usually within a working day), it is in test mode and sends only to addresses on your own verified domain.
5. In the server's **API Tokens**, copy the Server API token into `POSTMARK_SERVER_TOKEN` in Vercel (Sensitive), and redeploy. The app sends through the default transactional stream `outbound`.

**Receiving**

6. In the server's **Default Inbound Stream > Settings**, set the webhook URL to `https://postmark:<INBOUND_EMAIL_SECRET>@<your-production-domain>/api/inbound-email`. Use the production domain, not a deployment URL: Vercel's Deployment Protection refuses outside callers there. "Include raw email content" can stay off.
7. Route the intake mailbox to the stream's inbound address (`…@inbound.postmarkapp.com`, on the same settings page), in one of two ways:
   - Forward the mailbox (for example `cases@yourdomain.com`) to it. Microsoft 365 blocks automatic forwarding outside the organisation by default; an admin has to allow it.
   - Or use an inbound domain: an MX record for a subdomain such as `intake.yourdomain.com` pointing to `inbound.postmarkapp.com`, entered as **Inbound domain** in the stream's settings.

**Testing**

8. On a case's **Communications** tab, send a template e-mail to your own address. It arrives, and Postmark's **Activity** shows it.
9. Send an e-mail with an existing case number in the subject to the intake address: it appears on the case's Communications tab. Without a case number, it appears in the Inbox.
10. If an e-mail doesn't arrive, the inbound activity in Postmark shows the webhook's answer:
    - **401**: the secret in the webhook URL doesn't match `INBOUND_EMAIL_SECRET` in Vercel, or the deployment predates it.
    - **413**: the e-mail is larger than the 4.5 MB Vercel accepts. Save it as `.eml` and use "Upload .eml" in the Inbox.
