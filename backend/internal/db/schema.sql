-- Home Finance Manager — PostgreSQL schema
-- Run this against your database once (e.g. via pgAdmin's Query Tool,
-- or `psql -U youruser -d homefinance -f schema.sql`).
--
-- Every registered user has their own private data — every table below
-- (except the global `categories` reference list) is scoped by user_id,
-- enforced both by foreign key and by every query in internal/handlers.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One profile row per user, created automatically at registration
-- (see internal/handlers/auth.go). Holds the display name / notification
-- email / currency shown on the Profile page.
CREATE TABLE IF NOT EXISTS families (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Household',
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'BDT'
);

-- People a user has invited (by email) to be notified — informational
-- only, does not grant them a login or access to the inviter's data.
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Member',
  invitation_status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | accepted
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);

-- Global reference data (not user-owned) — the fixed list of income/expense
-- categories every user picks from.
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  label TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL REFERENCES categories(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);

CREATE TABLE IF NOT EXISTS savings_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target NUMERIC(12, 2) NOT NULL CHECK (target > 0),
  saved NUMERIC(12, 2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#1F3D3A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);

-- Ownership follows the parent goal (goal_id -> savings_goals.user_id),
-- checked in the handler before any insert/read — no separate user_id
-- needed here since a contribution never exists without its goal.
CREATE TABLE IF NOT EXISTS savings_contributions (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT,
  principal NUMERIC(12, 2) NOT NULL,
  remaining NUMERIC(12, 2) NOT NULL,
  interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  monthly_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  next_due_date DATE,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);

CREATE TABLE IF NOT EXISTS budgets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES categories(id),
  monthly_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(id),
  amount NUMERIC(12, 2) NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  autopay BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);

-- Manually-created calendar entries (the "Add Event" button).
-- Income/expense/bill/loan events are derived on the fly from their own
-- tables; this table only holds events the user added directly.
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'other', -- income | expense | savings | other
  title TEXT NOT NULL,
  amount NUMERIC(12, 2),
  date DATE NOT NULL,
  notes TEXT,
  repeat TEXT NOT NULL DEFAULT 'none', -- none | weekly | monthly | yearly
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_reminder BOOLEAN NOT NULL DEFAULT true,
  weekly_summary BOOLEAN NOT NULL DEFAULT true,
  bill_reminders BOOLEAN NOT NULL DEFAULT true,
  spending_alerts BOOLEAN NOT NULL DEFAULT true,
  reminder_threshold INTEGER NOT NULL DEFAULT 80
);

-- Tracks which (user, YYYY-MM or "week:"/"alert:"-prefixed key) summaries
-- have already been emailed, so the scheduler never repeats itself.
CREATE TABLE IF NOT EXISTS sent_summaries (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_key)
);

-- ---------- Seed data (global reference data only — no per-user rows;
-- those are created at registration, see internal/handlers/auth.go) ----------

INSERT INTO categories (id, type, label, color) VALUES
  ('salary', 'income', 'Salary', '#1F3D3A'),
  ('business', 'income', 'Business', '#2F5650'),
  ('freelancing', 'income', 'Freelancing', '#C9A227'),
  ('rental', 'income', 'Rental Income', '#9A7B18'),
  ('other_income', 'income', 'Other', '#68746D'),
  ('groceries', 'expense', 'Groceries', '#B54834'),
  ('transport', 'expense', 'Transportation', '#D5735C'),
  ('bills', 'expense', 'Bills & Utilities', '#8C3423'),
  ('education', 'expense', 'Education', '#C9A227'),
  ('medical', 'expense', 'Medical', '#2F5650'),
  ('shopping', 'expense', 'Shopping', '#9A7B18'),
  ('dining', 'expense', 'Dining Out', '#E4C868'),
  ('housing', 'expense', 'Housing', '#1F3D3A'),
  ('other_expense', 'expense', 'Other', '#68746D')
ON CONFLICT (id) DO NOTHING;
