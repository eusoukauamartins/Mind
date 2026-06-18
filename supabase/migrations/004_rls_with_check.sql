-- Lyria Supabase Migration — Step 4 (Explicit RLS WITH CHECK)
-- Run this in the Supabase SQL Editor.
--
-- Purpose: the policies created in 001_foundation.sql use only USING (...) with no
-- explicit WITH CHECK. This migration recreates them with BOTH USING and WITH CHECK
-- set to (auth.uid() = user_id) so insert/update paths are unambiguous and consistent
-- with the rewards table (002). This does NOT weaken isolation — it makes it explicit.
--
-- Safe to run multiple times (DROP POLICY IF EXISTS + CREATE).
-- Does NOT disable RLS. Does NOT use the service role. Does NOT change ownership rules.

-- ============================================================
-- Helper pattern applied per table:
--   DROP POLICY IF EXISTS "<name>" ON public.<table>;
--   CREATE POLICY "<name>" ON public.<table> FOR ALL
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- ============================================================

-- USER SETTINGS
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- MIGRATION STATE
DROP POLICY IF EXISTS "Users can manage own migration state" ON public.migration_state;
CREATE POLICY "Users can manage own migration state"
  ON public.migration_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- TASKS
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks"
  ON public.tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- LEARNINGS
DROP POLICY IF EXISTS "Users can manage own learnings" ON public.learnings;
CREATE POLICY "Users can manage own learnings"
  ON public.learnings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- EXPERIMENTS
DROP POLICY IF EXISTS "Users can manage own experiments" ON public.experiments;
CREATE POLICY "Users can manage own experiments"
  ON public.experiments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DAILY CHECKINS
DROP POLICY IF EXISTS "Users can manage own daily checkins" ON public.daily_checkins;
CREATE POLICY "Users can manage own daily checkins"
  ON public.daily_checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- TIME ALLOCATIONS
DROP POLICY IF EXISTS "Users can manage own time allocations" ON public.time_allocations;
CREATE POLICY "Users can manage own time allocations"
  ON public.time_allocations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DAILY QUOTE STATE
DROP POLICY IF EXISTS "Users can manage own daily quote state" ON public.daily_quote_state;
CREATE POLICY "Users can manage own daily quote state"
  ON public.daily_quote_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WORKOUT ROUTINES
DROP POLICY IF EXISTS "Users can manage own workout routines" ON public.workout_routines;
CREATE POLICY "Users can manage own workout routines"
  ON public.workout_routines FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WORKOUT LOGS
DROP POLICY IF EXISTS "Users can manage own workout logs" ON public.workout_logs;
CREATE POLICY "Users can manage own workout logs"
  ON public.workout_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- PROJECTS
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FIXED COSTS
DROP POLICY IF EXISTS "Users can manage own fixed costs" ON public.fixed_costs;
CREATE POLICY "Users can manage own fixed costs"
  ON public.fixed_costs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FINANCE ENTRIES
DROP POLICY IF EXISTS "Users can manage own finance entries" ON public.finance_entries;
CREATE POLICY "Users can manage own finance entries"
  ON public.finance_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FINANCE IMPORT DRAFTS
DROP POLICY IF EXISTS "Users can manage own finance import drafts" ON public.finance_import_drafts;
CREATE POLICY "Users can manage own finance import drafts"
  ON public.finance_import_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- REWARDS (already has WITH CHECK in 002; recreated here for consistency/idempotency)
DROP POLICY IF EXISTS "Users can manage own rewards" ON public.rewards;
CREATE POLICY "Users can manage own rewards"
  ON public.rewards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- PROFILES (id-keyed). Make the UPDATE policy explicit with WITH CHECK.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
