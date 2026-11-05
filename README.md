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
- **Accounts and Contacts** (UC-38): browse, search, create and edit.
- **Cases:**
  - list with search, filters and client tiles (UC-04 to UC-06)
  - create a case with an automatic case number (UC-08, BR-01)
  - case screen tabs:
    - **Case:** header, VDA/PO references with BR-11 warning, on hold, tags
    - **Vehicle:** maintain the vehicle, or find an existing one and link it
    - **Parties**
    - **Damage:** details and damaged parts
    - **Documents**
    - **History**
  - a status dropdown, handled by the status engine
- **Documents** (UC-36): case documents and a central page for shared documents.
  - Files go straight from the browser to the private Storage bucket `documents`, which the migrations create.
  - Limits: 20 MB per file; PDF, images, Word, Excel, `.eml` and text.

Every change to a case is recorded in its History by a database trigger. Status changes go only through the status engine (`docs/decisions.md`, D-033 and D-034).

## Project layout

```
src/
  app/            Routes and UI. No database access here (ESLint enforces it)
  components/     Shared UI; components/ui/ holds the shadcn/ui components
  domain/         Business rules, repositories and services (auth, accounts, contacts, cases,
                  vehicles, parties, damage, documents, history, lookups, users)
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

1. Push the repository to GitHub.
2. In Vercel, click **Add New > Project** and import the repository. The framework preset is detected as Next.js, and the defaults need no changes.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with the same values as in `.env.local`.

   The running app doesn't need `SUPABASE_SECRET_KEY` (only the seed script does), so don't add it.
4. Click **Deploy**.
5. In the Supabase dashboard, go to **Authentication > URL Configuration**. Set **Site URL** to the Vercel production URL (for example `https://go-smart-crm.vercel.app`), and add `http://localhost:3000` under **Redirect URLs**.
6. Open the Vercel URL and sign in with a seeded user. You should see the empty dashboard.
