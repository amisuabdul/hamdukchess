CREATE TABLE public.user_endgame_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endgame_id TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  best_move_count INT,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endgame_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_endgame_progress TO authenticated;
GRANT ALL ON public.user_endgame_progress TO service_role;

ALTER TABLE public.user_endgame_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own endgame progress"
  ON public.user_endgame_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own endgame progress"
  ON public.user_endgame_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own endgame progress"
  ON public.user_endgame_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own endgame progress"
  ON public.user_endgame_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_endgame_progress_updated_at
  BEFORE UPDATE ON public.user_endgame_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_user_endgame_progress_user ON public.user_endgame_progress(user_id);