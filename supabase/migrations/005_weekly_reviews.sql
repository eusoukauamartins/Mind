-- Lyria Supabase Migration — Step 5 (Weekly Reviews Cloud Sync)
-- Run this in the Supabase SQL Editor.
--
-- Adds the weekly_reviews table so Weekly Reviews sync to the cloud like every other
-- module (previously local-only and lost on logout / new device).

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_ref TEXT,
  week_start DATE,
  week_end DATE,
  what_worked TEXT,
  what_did_not_work TEXT,
  time_wasted TEXT,
  money_wasted TEXT,
  biggest_learnings TEXT,
  main_wins TEXT,
  focus_next_week TEXT,
  list_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own weekly reviews" ON public.weekly_reviews;
CREATE POLICY "Users can manage own weekly reviews"
  ON public.weekly_reviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_reviews_user_start_idx ON public.weekly_reviews(user_id, week_start DESC);

DROP TRIGGER IF EXISTS weekly_reviews_updated_at ON public.weekly_reviews;
CREATE TRIGGER weekly_reviews_updated_at
  BEFORE UPDATE ON public.weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reviews TO authenticated;
