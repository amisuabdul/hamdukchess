CREATE TABLE public.assistant_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_threads_user_idx ON public.assistant_threads(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_threads TO authenticated;
GRANT ALL ON public.assistant_threads TO service_role;
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads select" ON public.assistant_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own threads insert" ON public.assistant_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own threads update" ON public.assistant_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own threads delete" ON public.assistant_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER assistant_threads_touch BEFORE UPDATE ON public.assistant_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.assistant_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  sdk_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_thread_idx ON public.assistant_messages(thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.assistant_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.assistant_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.assistant_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.weakness_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  games_analyzed integer NOT NULL DEFAULT 0,
  piece_blunders jsonb NOT NULL DEFAULT '{}'::jsonb,
  phase_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  capture_heatmap jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weakness_reports TO authenticated;
GRANT ALL ON public.weakness_reports TO service_role;
ALTER TABLE public.weakness_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own report select" ON public.weakness_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER weakness_reports_touch BEFORE UPDATE ON public.weakness_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();