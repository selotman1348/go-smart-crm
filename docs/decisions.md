# Decisions and open questions

This file records the decisions taken and the deviations from the docs, per iteration. Open questions are listed at the end, each with the assumption used until it is answered.

## Iteration 0 – Setup

| ID | Decision | Reason |
| --- | --- | --- |
| D-001 | Versions: Next.js 16.4 (App Router, React 19.3, Cache Components and Partial Prefetching on, as scaffolded), Tailwind CSS 4, shadcn/ui 4 (`base-nova` style, Base UI primitives), @supabase/supabase-js 2.119, @supabase/ssr 0.12, Supabase CLI 3.0 (dev dependency), zod 4, Vitest 5, Playwright 1.64, Node.js 24. | These were the latest stable versions at the start of the project. |
| D-002 | **Login uses the e-mail address and password** (Supabase Auth). UC-01 says "username": the e-mail address is the username. `User.username` from design.md 1.12 becomes a profile field in iteration 1. | Supabase Auth signs in with e-mail natively. Agreed with the product owner on 2026-11-05. |
| D-003 | **No self sign-up.** Sign-up is turned off in the Supabase project and in `supabase/config.toml`. Users are created by `npm run db:seed` or an admin through the Supabase dashboard. | Only internal users log in (requirements §2). |
| D-004 | Development uses a **hosted Supabase project**. The CI e2e job starts a **fresh local Supabase stack** on the runner, using the same CLI version as the dev dependency. | Docker is not used on the development machine. In CI, a fresh database each run proves the migrations apply from scratch, without any secrets. |
| D-005 | Supabase clients live in `src/lib/supabase/` and only `src/domain/` (and `src/proxy.ts`) may import them. An ESLint `no-restricted-imports` rule fails the lint when `src/app/**` or `src/components/**` imports `@supabase/*` or `@/lib/supabase/*`. | This enforces the repository rule in CLAUDE.md. |
| D-006 | The auth service (`src/domain/auth/auth-service.ts`) depends on a small `AuthClient` interface, not on the Supabase types. It is bound to the request's cookies in `src/domain/auth/index.ts`. | It can be unit tested with fakes, and the data platform can be replaced later. |
| D-007 | The session is checked twice: once in `src/proxy.ts` (optimistic redirect to `/login?next=…`), and again on the server in the app layout (`UserMenu`) and in every Server Action, through `src/domain/auth`. The `next` target only accepts same-site paths (`safeRedirectPath`). | The Next.js 16 guidance is not to rely on the proxy alone. The path check prevents open redirects. |
| D-008 | Sign-out ends only the current browser session (`scope: "local"`). | The Supabase default (`global`) would also sign the user out on their other devices. |
| D-009 | Sign-in errors show one generic message, "Invalid e-mail or password.", plus separate messages for rate limiting and unexpected failures. | The form does not reveal which e-mail addresses have an account. |
| D-010 | Seed users are fictitious, on the reserved `.example` domain: Alex Morgan and Sam Taylor (`@gosmart.example`). The password comes from `SEED_USER_PASSWORD`. | CLAUDE.md: fictitious seed data only. |
| D-011 | There are **no migrations in iteration 0**. `supabase/migrations/` is empty, and the schema, including the phase-2 hook tables, starts in iteration 1. | Iteration 0 has no tables of its own. |
| D-012 | `/` redirects to `/dashboard` (in `next.config.ts`). The app shell has only a header with the user's name and a "Sign out" button. Menu items are added when their pages exist. | No placeholder links before later iterations build the pages. |
| D-013 | **Deployment is prepared, not done.** The app builds for Vercel without configuration, and README.md has the steps. The product owner deploys, because it needs their Vercel and Supabase accounts. | Agreed on 2026-11-05. "Empty dashboard deployed" is complete once those steps have been run. |
| D-014 | CI uses GitHub Actions (`.github/workflows/ci.yml`) with two jobs: checks (lint, typecheck, unit tests, build) and e2e. It uses the pinned `supabase` dev dependency instead of the `supabase/setup-cli` action. | Local and CI then use the same CLI version. |
| D-015 | `createClient()` in `src/lib/supabase/server.ts` calls `connection()` before reading cookies. All server-side Supabase access therefore runs at request time, and is never part of a prerender or a runtime prefetch. It must not be called inside `"use cache"` functions. | Cache Components (D-001) rejected the session check during prerendering, because token validation reads the current time. A session is per request in any case. |
| D-016 | `npm audit` (2026-11-05) reports 2 low and 11 moderate findings, all in build tooling: `minimatch` and `deepmerge` through `eslint-config-next` / typescript-eslint and the `shadcn` CLI. The app imports only `shadcn/tailwind.css` from `shadcn`. They are accepted for now and should be re-checked when those packages update. | The only fixes npm offers are downgrades (`shadcn@1`, `eslint-config-next@15`). No finding is in code that serves requests. |

## Open questions

| ID | Question | Assumption until answered |
| --- | --- | --- |
| Q-001 | Do users need "Forgot password" / password reset? It is not in the requirements. | No. An admin resets passwords in the Supabase dashboard. |
| Q-002 | Do case handlers and case managers have different permissions (for example, who may change a status or close a case)? This decides the row-level security policies in iteration 1. | All internal users have the same permissions. |
| Q-003 | How long should a session last, and should idle users be signed out? | Supabase defaults: a 1-hour access token, refreshed automatically while the browser is in use. |
| Q-004 | Who creates new internal users after go-live: an admin screen in the app, or the Supabase dashboard? | The Supabase dashboard. No user-management screen in version 1. |
