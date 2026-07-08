
CREATE TABLE public.user_opening_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eco text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  mastered_depth int NOT NULL DEFAULT 0,
  last_practiced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, eco)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_opening_progress TO authenticated;
GRANT ALL ON public.user_opening_progress TO service_role;

ALTER TABLE public.user_opening_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own opening progress select" ON public.user_opening_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own opening progress insert" ON public.user_opening_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own opening progress update" ON public.user_opening_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own opening progress delete" ON public.user_opening_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_opening_progress_touch
  BEFORE UPDATE ON public.user_opening_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.user_repertoire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eco text NOT NULL,
  color text NOT NULL CHECK (color IN ('white','black')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, eco, color)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_repertoire TO authenticated;
GRANT ALL ON public.user_repertoire TO service_role;

ALTER TABLE public.user_repertoire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own repertoire select" ON public.user_repertoire
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own repertoire insert" ON public.user_repertoire
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own repertoire update" ON public.user_repertoire
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own repertoire delete" ON public.user_repertoire
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_repertoire_touch
  BEFORE UPDATE ON public.user_repertoire
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
