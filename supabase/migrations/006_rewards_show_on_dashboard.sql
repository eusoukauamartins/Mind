ALTER TABLE public.rewards
ADD COLUMN IF NOT EXISTS show_on_dashboard BOOLEAN DEFAULT false;
