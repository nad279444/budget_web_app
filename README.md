# Wealth — AI-Powered Budgeting

Wealth is a personal finance web app that turns plain-English descriptions of your
spending into a real, saved budget. It combines transaction tracking, budget
monitoring, automated email reports, and an AI money coach ("Savvy Sal") that does
all of its arithmetic through a sandboxed calculator and can record transactions
and budgets directly to your account.

Built with Next.js (App Router), TypeScript, Prisma/PostgreSQL, Better Auth, OpenAI,
Inngest, Resend, and Arcjet.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Background Jobs](#background-jobs)
- [Scripts](#scripts)
- [Deployment](#deployment)

## Features

### Authentication
- Google OAuth sign-in/sign-up via **Better Auth** (no passwords stored).
- Sessions persisted in PostgreSQL (`sessions` table) with secure, prefixed cookies.
- Route protection through middleware (`/dashboard`, `/transaction`, `/assistant`)
  that redirects unauthenticated users to `/sign-in?redirect=...` and returns them
  to the page they wanted after login.
- User menu with avatar/initials, name, email, and sign-out.
- Landing page auto-redirects signed-in users: to `/dashboard` if they already have
  transactions, otherwise to `/transaction/create`.

### AI Money Coach ("Savvy Sal")
- Chat interface at `/assistant` where you describe how you spend money in everyday
  language (e.g. "I pay 1,800 cedis rent and 120 cedis a week on groceries").
  - **Tool-calling pipeline** with three tools:
  - `calculator` — every calculation is executed by a safe, sandboxed arithmetic
    evaluator (no `eval`); the model is never trusted to do math.
  - `create_budget` — saves a proposed total monthly budget.
  - `create_transaction` — records an already-happened income/expense.
- **Real-time streaming** over Server-Sent Events (`/api/assistant`): shows status
  updates ("Running the numbers…", "Writing your answer…"), streams the summary as
  it is generated, then renders the full structured result.
- **Monthly normalization** of habits: daily × 365 ÷ 12, weekly × 52 ÷ 12,
  biweekly × 26 ÷ 12, yearly ÷ 12, with weekday/weekend patterns combined first.
- **"How I did the math"** breakdown built from the actual calculator calls
  (ground truth), not the model's prose.
- **Extracted spending habits** list with per-category monthly equivalents.
- **Insights**: where your money goes (top category + share), money left to save
  (monthly income − expenses from your last 3 months of records), and where to put
  it, plus a targeted savings tip.
- **Multi-currency awareness**: detects the currency you write in (cedis, dollars,
  euros, pounds, naira, rupees, shillings, rand, etc.) and mirrors it without ever
  converting or inventing exchange rates.
- Reads your last 3 months of real transactions to ground its advice.

### Receipt Scanner
- Upload or capture a receipt photo on the transaction form.
- OpenAI vision extracts amount, date, merchant, description, and a suggested
  category, then auto-fills the form.
- 4 MB file-size guard with user feedback.

### Transaction Tracking
- Create, edit, and delete income and expense transactions.
- Zod-validated form with type, amount, category, date picker, and description.
- Filterable/sortable transaction table: search by description, filter by type
  and recurring status, sort by date/amount/category, paginated (10 per page).
- Bulk select and bulk delete.
- Color-coded categories with a rich default category set (income + expense,
  including subcategories).

### Budget Tracking
- Set and edit a monthly budget inline from the dashboard.
- Live progress bar with color thresholds (green < 75%, yellow ≥ 75%, red ≥ 90%).
- Shows amount spent vs. budget for the current month.

### Dashboard & Analytics
- Recent transactions list (last 5) with income/expense indicators.
- Monthly expense breakdown pie chart by category (Recharts).
- Budget progress card and the full transaction table.
- Empty-state redirect to the transaction form when there are no transactions yet.

### Recurring Transactions
- Mark any transaction as recurring (daily, weekly, monthly, yearly).
- A daily Inngest cron (`trigger-recurring-transactions`) finds due transactions and
  queues them; a throttled worker (`process-recurring-transaction`, per-user rate
  limit) recreates them and advances the next recurring date.
- Next-occurrence date shown in the transaction table via tooltip.

### Automated Email Reports (Resend)
- **Monthly report** — first of each month, per user: income, expenses, net,
  category breakdown, plus 3 AI-generated actionable insights.
- **Budget alerts** — checked every 6 hours; emails the user when they've used
  ≥ 80% of their budget (at most once per month).
- React Email templates with a graceful fallback if AI insight generation fails.

### AI Safety & Guardrails
- **Tool-layer authorization (the real boundary)**: the coach's `create_budget`
  and `create_transaction` tools write exclusively to the authenticated user
  (`requireUserId()`) and validate every argument with Zod. The model is treated
  as an untrusted caller, so a hijacked prompt cannot cross user boundaries. This
  costs 0 ms and holds even when an injection succeeds.
- **Assistant rate limiting**: the SSE endpoint is protected by Arcjet's token
  bucket (30 requests/hour per user), capping cost abuse and brute-force
  injection attempts. No-ops gracefully when `ARCJET_KEY` is absent.
- **Cheap input screening**: `lib/ai/guards.ts` enforces a 2000-character cap and
  rejects obvious instruction-override / system-prompt-extraction / jailbreak
  patterns in-process before any Arcjet or OpenAI call. Heuristic only — a fast
  first layer, not a security boundary.
- **Transaction rate limiting**: Arcjet token bucket (10 requests/hour per user)
  on transaction creation.
- **Single guarded entry point**: all coach traffic flows through
  `/api/assistant`; the previous server-action shortcut that called `runAssistant`
  directly has been removed so the guards cannot be bypassed.

### Resilience & UX
- **Offline-aware chat**: messages sent while offline are queued in `localStorage`
  and automatically flushed when connectivity returns, with a "Retry now" action.
- **Network status UI**: toast + persistent banner for offline, warning for slow
  connections (Network Information API).
- Floating chat button (hidden on auth/assistant routes) for quick access everywhere.
- 404 page and toast notifications throughout.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js (App Router) + React |
| Language | TypeScript |
| Database | PostgreSQL via Prisma |
| Auth | Better Auth (Google OAuth) |
| AI | OpenAI (Responses API, structured outputs, vision) |
| Background jobs | Inngest (cron + events) |
| Email | Resend + React Email |
| Rate limiting / abuse protection | Arcjet (per-user token bucket) |
| UI | Tailwind CSS, Radix UI, shadcn-style components, Recharts, sonner |

## Project Structure

```
app/
  (auth)/            Sign-in and sign-up pages
  (main)/
    assistant/       AI money coach chat
    dashboard/       Budget progress, analytics, transaction table
    transaction/     Create/edit transaction + receipt scanner
  api/
    assistant/       SSE streaming endpoint for the coach
    auth/[...all]/   Better Auth handler
    inngest/         Inngest serve handler
    seed/            Demo data seeder
actions/             Server actions (budget, transaction, dashboard, email, seed)
components/          UI, auth, header, hero, network status, floating chat
data/                Categories and landing-page content
emails/              React Email templates
hooks/               useFetch, useNetworkStatus
lib/
  ai/                Assistant core, persona, calculator, currency, schemas, reasoning, input guards
  inngest/           Client and background functions
  auth.ts            Better Auth config
  prisma.ts          Prisma client singleton
  session.ts         Cached session helpers
prisma/              Schema and migrations
middleware.ts        Route protection
```

## Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon, Supabase, local, etc.)
- Google OAuth credentials
- API keys for OpenAI, Resend, Arcjet (optional), and an Inngest account (optional for local)

### Install and run

```bash
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env` file in the project root. Provide your own values — never commit
real secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection string (Prisma runtime) |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection string (Prisma migrations) |
| `BETTER_AUTH_SECRET` | Yes | Signing secret for sessions/cookies |
| `BETTER_AUTH_URL` | Yes | Public base URL (`http://localhost:3000` locally, your domain in production) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `OPENAI_KEY` (or `OPENAI_API_KEY`) | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Model for receipt scanning / insights (default `gpt-4o-mini`) |
| `OPENAI_ASSISTANT_MODEL` | No | Model for the coach (defaults to `OPENAI_MODEL` or `gpt-4.1-mini`) |
| `RESEND_API_KEY` | Yes | Resend key for report/alert emails |
| `ARCJET_KEY` | No | Enables rate limiting (disabled if unset) |
| `INNGEST_EVENT_KEY` | Prod | Inngest event key |
| `INNGEST_SIGNING_KEY` | Prod | Inngest signing key |

## Database

Prisma models (`prisma/schema.prisma`):

- `User`, `Session`, `AuthAccount`, `Verification` — Better Auth core models.
- `Transaction` — type (income/expense), amount, category, date, receipt URL,
  recurring config, status.
- `Budget` — one per user with amount and last-alert timestamp.

Apply migrations with `npx prisma migrate dev` (local) or `npx prisma migrate deploy`
(production). Seed demo data at `/api/seed` (uses a hard-coded user ID in
`actions/seed.ts`).

## Background Jobs

Inngest functions (`lib/inngest/function.ts`), served at `/api/inngest`:

- `trigger-recurring-transactions` — daily cron, queues due recurring transactions.
- `process-recurring-transaction` — throttled per user, recreates the transaction.
- `generate-monthly-reports` — monthly cron, emails each user their report.
- `check-budget-alerts` — every 6 hours, emails users at ≥ 80% budget usage.

For local development run the Inngest dev server (`npx inngest-cli dev`) and point it
at `/api/inngest`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (`prisma generate` runs on install) |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run email` | Preview React Email templates |

## Deployment

Designed for [Vercel](https://vercel.com) + a hosted PostgreSQL database.

1. Set all required environment variables in your hosting provider.
2. Set `BETTER_AUTH_URL` to your public domain (e.g. `https://your-app.vercel.app`).
3. In Google Cloud Console, add the authorized redirect URI:
   `https://your-domain/api/auth/callback/google` and add your domain under
   authorized JavaScript origins.
4. Run `npx prisma migrate deploy` against the production database.
5. Configure Inngest (event + signing keys) and point it at `/api/inngest`.
6. Add your Resend sending domain / verified sender as needed.

> The auth cookies use a `wealth` prefix and are automatically namespaced with
> `__Secure-` on HTTPS. Middleware resolves the session via Better Auth's
> `getSessionCookie`, so production and localhost both work without code changes.
