# Go Smart CRM

New project: a case-centric CRM for managing vehicle damage repairs between clients, brokers/insurers, experts and a network of repairers.

## Read first, every session

1. `docs/requirements.md` – actors, business processes, use cases (UC-xx), case statuses and business rules (BR-xx).
2. `docs/design.md` – data model with all fields (section 1), case lifecycle (section 2), sequence diagrams (section 3) and solution architecture (section 4).
3. `docs/plan.md` – technology stack, e-mail intake, phase-2 hooks (section 3), iterations (section 4) and demo script (section 5).

Work on ONE iteration from `docs/plan.md` section 4 per session. Start in plan mode: propose the approach, wait for approval, then implement.

## Stack

- Next.js (App Router, TypeScript strict), Tailwind CSS, shadcn/ui
- Supabase: PostgreSQL (migrations in `supabase/migrations`), Auth, Storage
- Outbound e-mail through a transactional provider; inbound e-mail through a parsing webhook to `/api/inbound-email`
- Vitest for unit tests, Playwright for end-to-end tests

## Conventions

- Object and field names follow `docs/design.md` section 1 (snake_case in the database, camelCase in TypeScript).
- Business rules live in `src/domain/` services (case numbering, status engine, quote totals and validation, completeness checks, template rendering, inbound e-mail matching). Never in UI components.
- All database access goes through repositories in `src/domain/`. UI components never call the database directly.
- Every status change goes through the status engine and writes `status_history`, `event` and `audit_log`. The only automatic status change in version 1 is quote validation (BR-03).
- Case number = client code + 4-digit year + 4-digit sequence per client per year (BR-01).
- The phase-2 hook tables in `docs/plan.md` section 3 are part of the schema from iteration 1. Do not build AI features.
- External agents (API clients) may only create drafts. Final status changes and sending require a human user; enforce this in the API with scopes.
- UI language: English.
- Seed and test data: fictitious companies, people, e-mail addresses and licence plates only.
- Secrets only in `.env.local` (never committed); keep `.env.example` up to date.
- Do not add features, fields or statuses that are not in the docs. If something is unclear, ask, or record the question in `docs/decisions.md`.

## Definition of done (per iteration)

- Migrations apply cleanly on a fresh database; seed script updated.
- Unit tests for every new business rule; a Playwright test for the iteration's main flow.
- `npm run build`, lint and tests pass.
- Decisions and deviations recorded in `docs/decisions.md`.
