-- Lyria Supabase Foundation — Step 1 Migration
-- Run this in the Supabase SQL Editor or via Supabase CLI.
--
-- Tables: profiles, user_settings, migration_state
-- All tables have RLS enabled with auth.uid() policies.

-- ============================================================
-- 1. PROFILES
-- One row per authenticated user, auto-created via trigger.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ============================================================
-- 2. USER SETTINGS
-- Key-value settings per user (theme, accent, layout, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id);


-- ============================================================
-- 3. MIGRATION STATE
-- Tracks which collections have been migrated from localStorage.
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'migrating', 'completed', 'failed'
  local_count INTEGER DEFAULT 0,
  remote_count INTEGER DEFAULT 0,
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, collection_key)
);

ALTER TABLE migration_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own migration state"
  ON migration_state FOR ALL
  USING (auth.uid() = user_id);


-- ============================================================
-- 4. AUTO-CREATE PROFILE ON USER REGISTRATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to make this idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 5. UPDATED_AT AUTO-UPDATE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 6. GRANT PRIVILEGES TO PUBLIC ROLES (REQUIRED FOR RLS)
-- ============================================================

GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.user_settings TO anon, authenticated, service_role;
GRANT ALL ON public.migration_state TO anon, authenticated, service_role;


-- ============================================================
-- 7. TASKS TABLE (PWA CLOUD SYNC)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'média',
  estimated_hours DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pendente',
  due_date DATE,
  scheduled_date DATE,
  category TEXT,
  recurrence TEXT NOT NULL DEFAULT 'única',
  recurrence_day TEXT,
  completed_dates JSONB DEFAULT '[]'::jsonb,
  list_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tasks"
  ON public.tasks FOR ALL
  USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS tasks_user_scheduled_idx ON public.tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON public.tasks(user_id, created_at DESC);

-- Trigger for Auto-Updating updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grants only to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;


-- ============================================================
-- 8. LEARNINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN DEFAULT false,
  date DATE NOT NULL,
  list_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own learnings"
  ON public.learnings FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS learnings_user_date_idx ON public.learnings(user_id, date DESC);
CREATE INDEX IF NOT EXISTS learnings_user_fav_idx ON public.learnings(user_id, is_favorite);

CREATE TRIGGER learnings_updated_at
  BEFORE UPDATE ON public.learnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learnings TO authenticated;


-- ============================================================
-- 9. EXPERIMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  context TEXT,
  what_was_tested TEXT,
  result TEXT,
  main_error TEXT,
  lesson_learned TEXT,
  repeat_this TEXT NOT NULL DEFAULT 'sim',
  date DATE NOT NULL,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own experiments"
  ON public.experiments FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS experiments_user_cat_idx ON public.experiments(user_id, category);
CREATE INDEX IF NOT EXISTS experiments_user_date_idx ON public.experiments(user_id, date DESC);

CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiments TO authenticated;


-- ============================================================
-- 10. DAILY CHECKINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sleep TEXT,
  energy TEXT,
  mood TEXT,
  focus TEXT,
  day_quality TEXT,
  substances TEXT,
  helped TEXT,
  hindered TEXT,
  lost_focus BOOLEAN DEFAULT false,
  lost_time TEXT,
  focus_lost_to TEXT,
  cause_of_distraction TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily checkins"
  ON public.daily_checkins FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_checkins_user_date_idx ON public.daily_checkins(user_id, date DESC);

CREATE TRIGGER daily_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;


-- ============================================================
-- 11. TIME ALLOCATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  hours DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.time_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own time allocations"
  ON public.time_allocations FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS time_allocations_user_date_idx ON public.time_allocations(user_id, date DESC);

CREATE TRIGGER time_allocations_updated_at
  BEFORE UPDATE ON public.time_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_allocations TO authenticated;


-- ============================================================
-- 12. DAILY QUOTE STATE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_quote_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unlocked_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_quote_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily quote state"
  ON public.daily_quote_state FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER daily_quote_state_updated_at
  BEFORE UPDATE ON public.daily_quote_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_quote_state TO authenticated;


-- ============================================================
-- 13. WORKOUT ROUTINES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  day_name TEXT NOT NULL,
  is_rest_day BOOLEAN DEFAULT false,
  workout_type TEXT,
  planned_focus TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout routines"
  ON public.workout_routines FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workout_routines_user_day_idx ON public.workout_routines(user_id, day_of_week);

CREATE TRIGGER workout_routines_updated_at
  BEFORE UPDATE ON public.workout_routines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_routines TO authenticated;


-- ============================================================
-- 14. WORKOUT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  did_train BOOLEAN DEFAULT true,
  workout_done TEXT,
  followed_plan BOOLEAN DEFAULT true,
  how_it_went TEXT,
  energy TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout logs"
  ON public.workout_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx ON public.workout_logs(user_id, date DESC);

CREATE TRIGGER workout_logs_updated_at
  BEFORE UPDATE ON public.workout_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;


-- ============================================================
-- 15. PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  category TEXT,
  start_date DATE,
  target_date DATE,
  completed_at DATE,
  subtasks JSONB DEFAULT '[]'::jsonb,
  list_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS projects_user_status_idx ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS projects_user_order_idx ON public.projects(user_id, list_order);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;


-- ============================================================
-- 16. FIXED COSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'mensal',
  due_day TEXT NOT NULL DEFAULT '5',
  due_month TEXT NOT NULL DEFAULT '1',
  category TEXT,
  notes TEXT,
  paid_periods JSONB DEFAULT '[]'::jsonb,
  skipped_periods JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fixed costs"
  ON public.fixed_costs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS fixed_costs_user_category_idx ON public.fixed_costs(user_id, category);

CREATE TRIGGER fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_costs TO authenticated;


-- ============================================================
-- 17. FINANCE ENTRIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saída')),
  amount DOUBLE PRECISION NOT NULL,
  category TEXT,
  expense_class TEXT,
  subcategory TEXT,
  source TEXT,
  date DATE NOT NULL,
  notes TEXT,
  original_description TEXT,
  source_bank TEXT,
  account_name TEXT,
  duplicate_key TEXT,
  imported_from TEXT,
  fixed_cost_id UUID REFERENCES public.fixed_costs(id) ON DELETE SET NULL,
  period_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own finance entries"
  ON public.finance_entries FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS finance_entries_user_date_idx ON public.finance_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS finance_entries_user_type_idx ON public.finance_entries(user_id, type);
CREATE INDEX IF NOT EXISTS finance_entries_user_dup_idx ON public.finance_entries(user_id, duplicate_key);

CREATE TRIGGER finance_entries_updated_at
  BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;


-- ============================================================
-- 18. FINANCE IMPORT DRAFTS TABLE (TRANSIENT DATA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_import_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.finance_import_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own finance import drafts"
  ON public.finance_import_drafts FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER finance_import_drafts_updated_at
  BEFORE UPDATE ON public.finance_import_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_import_drafts TO authenticated;


