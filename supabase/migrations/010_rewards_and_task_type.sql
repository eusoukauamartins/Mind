-- Lyria Supabase Migration — Step 10 (Rewards Persistence & Task Type)
-- Run this in the Supabase SQL Editor.

-- 1. Add task_type column to tasks table (defaults to 'task')
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';

-- 2. Backfill legacy recurring tasks to 'routine'
UPDATE public.tasks 
SET task_type = 'routine' 
WHERE recurrence IN ('diária', 'semanal') 
  AND (task_type IS NULL OR task_type = 'task');

-- 3. Ensure all Rewards columns exist
ALTER TABLE public.rewards 
ADD COLUMN IF NOT EXISTS financial_target_amount DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS financial_current_amount DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS show_on_dashboard BOOLEAN DEFAULT false;

-- 4. Create index for task_type performance
CREATE INDEX IF NOT EXISTS tasks_user_task_type_idx ON public.tasks(user_id, task_type);
