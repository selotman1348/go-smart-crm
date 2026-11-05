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

3. **Configure the environment**

   ```sh
   cp .env.example .env.local
   ```

   Fill in `.env.local`, which git never tracks:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `SEED_USER_PASSWORD`: a password you choose for the fictitious users

4. **Seed the users and start the app**

   ```sh
   npm run db:seed   # creates alex.morgan@gosmart.example and sam.taylor@gosmart.example
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
| `npm run db:seed` | Create the fictitious users. Safe to repeat |
| `npm run db:link` / `npm run db:push` | Link the hosted project and apply `supabase/migrations` to it. Run `npx supabase login` first |
| `npm run db:start` / `db:stop` / `db:reset` | Optional local Supabase stack (needs Docker). CI uses it to test on a fresh database |

## Project layout

```
src/
  app/            Routes and UI. No database access here (ESLint enforces it)
  components/ui/  shadcn/ui components
  domain/         Business rules, repositories and services (auth for now)
  lib/            Supabase client factories and environment settings
  proxy.ts        Refreshes the session and redirects signed-out users
supabase/         Supabase CLI config, migrations and seed.sql
scripts/seed.ts   Creates the seed users through the Supabase admin API
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
