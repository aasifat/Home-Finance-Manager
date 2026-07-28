# Ledger — Home Finance Manager (Backend)

Go + PostgreSQL API for the home finance manager. No Docker required —
built to work with a PostgreSQL instance you manage via pgAdmin (or psql).

## 1. Create the database

In pgAdmin: create a new database (e.g. `homefinance`). Then open its
Query Tool, load `internal/db/schema.sql`, and run it. This creates every
table and seeds the global category list — everything else (profile,
budget defaults, notification settings) is created per-user automatically
when they register.

(Or from a terminal: `psql -U youruser -d homefinance -f internal/db/schema.sql`)

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
- `DB_*` — match whatever you used in pgAdmin
- `JWT_SECRET` — long random string used to sign login tokens (`openssl rand -hex 32`).
  If you leave it unset the server runs with an insecure default and logs a warning —
  fine for a quick local test, not for anything you'd expose.
- `SMTP_*` — real SMTP credentials to send real emails (e.g. Gmail with an
  [App Password](https://myaccount.google.com/apppasswords)), or leave
  `EMAIL_DRY_RUN=true` to just log emails to the console while developing
- `FRONTEND_ORIGIN` — your frontend's URL, for CORS (default matches `npm run dev`)
- `FRONTEND_URL` — used to build the "Open Ledger" link inside emails

## 3. Run

```bash
go mod tidy   # downloads dependencies and writes go.sum
go run .
```

You should see:
```
connected to database
Ledger API listening on :8080
```

Check it's alive: `curl http://localhost:8080/api/health`

## 4. Register and log in

Every route except `/api/health` and `/api/v1/auth/register|login|logout`
requires a valid session (`ledger_token` HttpOnly cookie holding a signed
JWT). Anyone can register their own account at the frontend's `/register`
page — full name, email, password — then sign in at `/login`. **Every
registered user has entirely private data** — their own transactions,
budget, bills, savings, loans, calendar events, and profile. Nobody sees
anyone else's.

Auth endpoints:
- `POST /api/v1/auth/register` — `{fullName, email, password, confirmPassword}` → 201, does **not** log you in. Also provisions this user's private `families` (profile) row, `notification_settings`, and starter `budgets`, all in one transaction.
- `POST /api/v1/auth/login` — `{email, password}` → 200 + sets the `ledger_token` cookie
- `GET /api/v1/auth/me` — 200 with the current user, or 401
- `POST /api/v1/auth/logout` — clears the cookie

Tokens are stateless JWTs (`internal/auth`), signed with `JWT_SECRET` and
valid for 7 days — no server-side session table, so nothing to clean up,
but also no way to force-revoke a single token before it expires short of
rotating the secret (which signs everyone out).

## What it does

- Full CRUD REST API for income/expenses, savings goals + contributions,
  loans + payments, budgets, recurring bills, and calendar events —
  **every table is scoped by `user_id`**, extracted from the JWT on every
  request (`userID()`/`requireUserID()` in `internal/handlers/handlers.go`)
- Real per-user accounts backed by a `users` table (`internal/handlers/auth.go`)
  — bcrypt-hashed passwords, unique email constraint, JWT auth via
  `internal/middleware/auth.go`
- Ownership enforcement on every update/delete: `enforceOwnership()` returns
  404 if the row doesn't exist at all, 403 if it exists but belongs to
  someone else — never a silent no-op
- Family members: adding one (with an email) sends a real invitation email
  in the background; the member's `invitationStatus` becomes `sent` or
  `failed` so the frontend can show a resend option. This is separate from
  login — inviting someone doesn't give them an account or access to your data.
- `GET /api/notifications/alerts` computes live alerts (bills due within 7
  days, failed invitations, over-budget categories, spending-pace threshold
  crossed) for the frontend's notification bell — scoped to the signed-in user
- A background scheduler (`internal/scheduler`) runs once a day and:
  - on the last day of the month, emails the "Where did our money go?"
    narrative summary to the family email and every invited member (once
    per family per month — tracked in `sent_summaries` so it never repeats)
  - emails a reminder for any bill due in 3 days, if bill reminders are
    enabled in notification settings
  - emails a weekly income/expense recap every Monday, if weekly summaries
    are enabled
  - emails a spending-pace alert the first time a month's spending crosses
    the configured percentage-of-income threshold
- `/api/reports/summary?month=YYYY-MM` computes the same narrative
  server-side, for the Dashboard and Reports page

## Notes on scope

- **Multi-tenant, one household per user**: every registered user gets
  their own fully private data — there's no cross-user sharing at all
  (that's a deliberate change from this app's earlier single-shared-household
  version). `categories` is the one exception: it's a fixed, global
  reference list (not user data), the same for everyone.
- **Recurring transaction auto-generation**: a transaction's `recurring`
  flag is stored but nothing currently auto-creates next month's entry from
  it — that would be a good next addition to the scheduler.

## Project layout

```
backend/
  main.go                     entry point, route table
  internal/
    auth/                     password hashing + JWT generate/parse
    config/                   env loading
    db/                       connection + schema.sql
    models/                   JSON-tagged structs shared by handlers
    httpx/                    JSON response/error helpers
    middleware/                CORS + request logging + auth gate
    email/                    SMTP sending (or dry-run logging)
    handlers/                 one file per resource (transactions, savings, ...)
    scheduler/                daily background email jobs
```
