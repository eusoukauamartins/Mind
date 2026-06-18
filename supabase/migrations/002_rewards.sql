-- Lyria Supabase Migration — Step 2 (Rewards Table)
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  estimated_value DOUBLE PRECISION,
  deadline DATE,
  redeem_available_date DATE,
  priority TEXT,
  status TEXT,
  conditions JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  redeemed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable Row-Level Security
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy for Authenticated Users (USING and WITH CHECK)
CREATE POLICY "Users can manage own rewards"
  ON public.rewards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS rewards_user_idx ON public.rewards(user_id);
CREATE INDEX IF NOT EXISTS rewards_user_status_idx ON public.rewards(user_id, status);

-- Trigger for Auto-Updating updated_at
CREATE TRIGGER rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
