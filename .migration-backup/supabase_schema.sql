-- ═══════════════════════════════════════════════════════════════════════
--  AI BOARDROOM — Supabase Schema Migration
--  Run this in: Supabase Dashboard → SQL Editor
--  Or via: supabase db push (if using Supabase CLI)
-- ═══════════════════════════════════════════════════════════════════════

-- Enable UUID extension (required for auth.users FK)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── user_credits ─────────────────────────────────────────────────────────
-- Tracks each authenticated user's credit balance.
-- user_id references Supabase Auth (auth.users).

CREATE TABLE IF NOT EXISTS public.user_credits (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  display_name     TEXT,
  credits          INTEGER NOT NULL DEFAULT 100,       -- welcome credits
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- ── credit_transactions ───────────────────────────────────────────────────
-- Immutable audit log of every credit change.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL,                  -- positive = credit, negative = debit
  type             TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'welcome_bonus', 'refund')),
  description      TEXT,
  task_id          INTEGER,                           -- optional link to boardroom task
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────
-- Users can only read their own credits and transactions.
-- Writes must go through your server (service_role key bypasses RLS).

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- user_credits: read own row only
CREATE POLICY "Users can read own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- credit_transactions: read own rows only
CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── Auto-create credits row on sign-up (via DB trigger) ───────────────────
-- Automatically provisions a user_credits row when a new user signs up.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, email, display_name, credits, total_credits_used)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    100,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (
    NEW.id,
    100,
    'welcome_bonus',
    'ยินดีต้อนรับ! รับเครดิตเริ่มต้น 100 เครดิต'
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Credit cost per boardroom level ──────────────────────────────────────
-- Reference table for how many credits each analysis level costs.

CREATE TABLE IF NOT EXISTS public.credit_costs (
  level      INTEGER PRIMARY KEY,
  credits    INTEGER NOT NULL,
  label      TEXT NOT NULL
);

INSERT INTO public.credit_costs (level, credits, label) VALUES
  (0, 0, 'สนทนาทั่วไป'),
  (1, 1, 'ค้นข้อมูลด่วน'),
  (2, 3, 'วิเคราะห์เปรียบเทียบ'),
  (3, 8, 'วิเคราะห์กลยุทธ์เต็มรูปแบบ')
ON CONFLICT (level) DO NOTHING;

-- ── Useful views ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.user_credit_summary AS
SELECT
  uc.user_id,
  uc.email,
  uc.display_name,
  uc.credits AS remaining_credits,
  uc.total_credits_used,
  COUNT(ct.id) AS transaction_count,
  uc.created_at AS member_since,
  uc.updated_at AS last_activity
FROM public.user_credits uc
LEFT JOIN public.credit_transactions ct ON ct.user_id = uc.user_id
GROUP BY uc.user_id, uc.email, uc.display_name, uc.credits, uc.total_credits_used, uc.created_at, uc.updated_at;
