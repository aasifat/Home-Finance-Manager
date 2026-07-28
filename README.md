# Ledger — Home Finance Manager (Full Stack)

A family home finance manager: income, expenses, savings goals, loans and
debts, budgets, recurring bills, a calendar (with an Add Event button), and
an auto-generated "Where did our money go?" monthly summary emailed to the
household. Adding a family member sends them an invitation email.

- `backend/` — Go 1.22 + PostgreSQL REST API, SMTP email, daily scheduler
- `frontend/` — React + Vite, same design as the original demo, now wired to the real API

## Quick start

```bash
# 1. Database — in pgAdmin, create a DB and run backend/internal/db/schema.sql

# 2. Backend
cd backend
cp .env.example .env      # fill in DB + SMTP settings
go mod tidy
go run .                   # http://localhost:8080

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env       # defaults to http://localhost:8080/api
npm install
npm run dev                 # http://localhost:5173
```

See `backend/README.md` and `frontend/README.md` for full details.

## What changed from the demo

- **Real backend**: every page now reads and writes through the Go API
  instead of localStorage. The visual design, layout, and page structure
  are unchanged.
- **Calendar → Add Event**: a new button (in the toolbar and in the
  selected-day panel) opens a modal to add a one-off or repeating event
  directly on the calendar, stored server-side.
- **Profile → family members now have email + invitations**: adding a
  member requires an email address; the backend sends them a real
  invitation email (or logs it, if `EMAIL_DRY_RUN=true`) and the UI shows
  whether the invite is pending, sent, or failed, with a resend option.

## A note on what I couldn't verify

I don't have internet access in this environment, so I couldn't run
`go mod tidy` / `go run` or `npm install` / `npm run dev` end-to-end here.
I hand-checked every Go and JS/JSX file for balanced braces/parens and
reviewed the logic carefully, but please do a real smoke test on your end
— starting with `go run .` against a real Postgres database —
and let me know what breaks.
