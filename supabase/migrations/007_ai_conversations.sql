-- Lyria Supabase Migration — Step 7 (AI Conversations and Messages Tables)
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ai_conversations_pkey PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  attachments_meta JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_messages_pkey PRIMARY KEY (user_id, id),
  CONSTRAINT ai_messages_conversation_fkey FOREIGN KEY (user_id, conversation_id) REFERENCES public.ai_conversations(user_id, id) ON DELETE CASCADE
);

-- Enable Row-Level Security
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Authenticated Users (USING and WITH CHECK)
DROP POLICY IF EXISTS "Users can manage own ai conversations" ON public.ai_conversations;
CREATE POLICY "Users can manage own ai conversations"
  ON public.ai_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own ai messages" ON public.ai_messages;
CREATE POLICY "Users can manage own ai messages"
  ON public.ai_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_updated_at_idx ON public.ai_conversations(updated_at);
CREATE INDEX IF NOT EXISTS ai_conversations_pinned_idx ON public.ai_conversations(pinned);
CREATE INDEX IF NOT EXISTS ai_conversations_archived_idx ON public.ai_conversations(archived);
CREATE INDEX IF NOT EXISTS ai_conversations_deleted_at_idx ON public.ai_conversations(deleted_at);

CREATE INDEX IF NOT EXISTS ai_messages_user_idx ON public.ai_messages(user_id);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_at_idx ON public.ai_messages(created_at);

-- Trigger for Auto-Updating updated_at on ai_conversations
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
