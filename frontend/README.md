# Ledger — Home Finance Manager (Frontend)

The React frontend, now wired to the real Go + PostgreSQL backend instead of
localStorage. Visually and functionally the same as the earlier demo, plus:

- **Calendar → Add Event** — add one-off or repeating events (income,
  expense, savings, or general) directly from the calendar
- **Profile → Family Members** — adding a member now takes an email address
  and sends them a real invitation email via the backend

## Setup

1. Make sure the backend is running first (see `../backend/README.md`).
2. Configure the API URL:
   ```bash
   cp .env.example .env
   # edit .env if your backend isn't on http://localhost:8080
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the URL Vite prints (usually http://localhost:5173).

If the backend isn't reachable, the app shows a "Can't reach the Ledger API"
screen with a retry button instead of a blank/broken UI.

## What changed from the standalone demo

- `src/context/AppContext.jsx` — every action (`addTransaction`,
  `contributeSavings`, `recordLoanPayment`, etc.) now calls the API via
  `src/api/client.js` and updates state from the response, instead of
  writing straight to `localStorage`. The exported selectors
  (`monthTotals`, `categoryBreakdown`, `buildNarrative`, …) are unchanged —
  they still work against the in-memory transaction list.
- `src/pages/CalendarPage.jsx` — added the **Add Event** button/modal and
  fetches manually-added events per month from `/api/calendar/events`.
- `src/pages/Profile.jsx` — the "add member" form now has an email field;
  submitting calls `POST /api/members`, which triggers the invitation email
  on the backend. Each member shows their invitation status, with a resend
  button if it failed.
- `src/App.jsx` — added loading and connection-error states around the
  route tree.

## Pages

Dashboard, Income, Expenses, Savings, Loans & Debts, Budget, Bills,
Reports, Calendar, Profile — same as before, now all reading and writing
through the API.

## Notes

- All data now lives in PostgreSQL, managed by the backend. There's no
  local persistence in the browser anymore.
- Design: "household ledger" aesthetic — deep pine green + gold, Fraunces
  for display type, Inter for UI text, IBM Plex Mono for tabular figures.
