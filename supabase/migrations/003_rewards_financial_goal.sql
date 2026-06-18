-- Lyria Supabase Migration — Step 3 (Rewards Financial Goal Columns)
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.rewards 
ADD COLUMN IF NOT EXISTS financial_target_amount DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS financial_current_amount DOUBLE PRECISION;
