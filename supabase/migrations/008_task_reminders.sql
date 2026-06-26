-- Lyria Supabase Migration — Step 8 (Task Reminders)
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_time TIME NULL,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
