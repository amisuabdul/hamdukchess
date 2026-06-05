
-- puzzles
CREATE TABLE public.puzzles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fen TEXT NOT NULL,
  solution TEXT[] NOT NULL,
  themes TEXT[] NOT NULL DEFAULT '{}',
  rating INTEGER NOT NULL DEFAULT 1200,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  daily_date DATE UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX puzzles_rating_idx ON public.puzzles(rating) WHERE approved = true;
CREATE INDEX puzzles_themes_idx ON public.puzzles USING gin(themes) WHERE approved = true;
CREATE INDEX puzzles_creator_idx ON public.puzzles(creator_id);

GRANT SELECT ON public.puzzles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.puzzles TO authenticated;
GRANT ALL ON public.puzzles TO service_role;

ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved puzzles readable by all"
  ON public.puzzles FOR SELECT
  USING (approved = true OR creator_id = auth.uid());

CREATE POLICY "Authenticated users submit puzzles"
  ON public.puzzles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND approved = false);

CREATE POLICY "Creators update own pending puzzles"
  ON public.puzzles FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id AND approved = false)
  WITH CHECK (auth.uid() = creator_id AND approved = false);

-- puzzle_ratings (per-user attempt + Leitner state)
CREATE TABLE public.puzzle_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  leitner_box INTEGER NOT NULL DEFAULT 1,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  solved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, puzzle_id)
);
CREATE INDEX puzzle_ratings_due_idx ON public.puzzle_ratings(user_id, next_due_at);

GRANT SELECT, INSERT, UPDATE ON public.puzzle_ratings TO authenticated;
GRANT ALL ON public.puzzle_ratings TO service_role;
ALTER TABLE public.puzzle_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own puzzle ratings"
  ON public.puzzle_ratings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_puzzle_stats
CREATE TABLE public.user_puzzle_stats (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1200,
  solved_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_solved_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_puzzle_stats TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_puzzle_stats TO authenticated;
GRANT ALL ON public.user_puzzle_stats TO service_role;
ALTER TABLE public.user_puzzle_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stats readable by all"
  ON public.user_puzzle_stats FOR SELECT USING (true);
CREATE POLICY "Users update own stats"
  ON public.user_puzzle_stats FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger using existing touch_updated_at()
CREATE TRIGGER puzzles_touch BEFORE UPDATE ON public.puzzles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER puzzle_ratings_touch BEFORE UPDATE ON public.puzzle_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_puzzle_stats_touch BEFORE UPDATE ON public.user_puzzle_stats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic attempt submission: updates rating + Leitner state + user stats
CREATE OR REPLACE FUNCTION public.submit_puzzle_attempt(
  p_puzzle_id UUID,
  p_success BOOLEAN
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  pz_rating INT;
  cur_rating INT;
  cur_box INT;
  new_box INT;
  due_interval INTERVAL;
  expected FLOAT;
  delta INT;
  new_rating INT;
  today DATE := (now() AT TIME ZONE 'UTC')::DATE;
  cur_streak INT;
  best_streak INT;
  last_date DATE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT rating INTO pz_rating FROM public.puzzles WHERE id = p_puzzle_id;
  IF pz_rating IS NULL THEN RAISE EXCEPTION 'puzzle not found'; END IF;

  -- Seed user stats
  INSERT INTO public.user_puzzle_stats (user_id) VALUES (me) ON CONFLICT DO NOTHING;
  SELECT rating, current_streak, best_streak, last_solved_date
    INTO cur_rating, cur_streak, best_streak, last_date
    FROM public.user_puzzle_stats WHERE user_id = me FOR UPDATE;

  expected := 1.0 / (1.0 + power(10, (pz_rating - cur_rating) / 400.0));
  delta := round(20 * ((CASE WHEN p_success THEN 1 ELSE 0 END) - expected));
  new_rating := greatest(400, cur_rating + delta);

  -- Existing attempt?
  SELECT leitner_box INTO cur_box FROM public.puzzle_ratings
    WHERE user_id = me AND puzzle_id = p_puzzle_id FOR UPDATE;
  cur_box := COALESCE(cur_box, 1);

  IF p_success THEN
    new_box := least(5, cur_box + 1);
  ELSE
    new_box := 1;
  END IF;

  due_interval := (CASE new_box
    WHEN 1 THEN INTERVAL '1 day'
    WHEN 2 THEN INTERVAL '3 days'
    WHEN 3 THEN INTERVAL '7 days'
    WHEN 4 THEN INTERVAL '21 days'
    ELSE INTERVAL '60 days'
  END);

  INSERT INTO public.puzzle_ratings (user_id, puzzle_id, success, leitner_box, next_due_at, solved_at)
    VALUES (me, p_puzzle_id, p_success, new_box, now() + due_interval,
            CASE WHEN p_success THEN now() ELSE NULL END)
    ON CONFLICT (user_id, puzzle_id) DO UPDATE SET
      success = EXCLUDED.success,
      attempts = public.puzzle_ratings.attempts + 1,
      leitner_box = EXCLUDED.leitner_box,
      next_due_at = EXCLUDED.next_due_at,
      solved_at = COALESCE(EXCLUDED.solved_at, public.puzzle_ratings.solved_at),
      updated_at = now();

  -- Streak logic
  IF p_success THEN
    IF last_date IS NULL OR last_date < today - INTERVAL '1 day' THEN
      cur_streak := 1;
    ELSIF last_date = today - INTERVAL '1 day' THEN
      cur_streak := cur_streak + 1;
    END IF;
    best_streak := greatest(best_streak, cur_streak);
    last_date := today;
  END IF;

  UPDATE public.user_puzzle_stats SET
    rating = new_rating,
    solved_count = solved_count + (CASE WHEN p_success THEN 1 ELSE 0 END),
    failed_count = failed_count + (CASE WHEN p_success THEN 0 ELSE 1 END),
    current_streak = cur_streak,
    best_streak = best_streak,
    last_solved_date = last_date,
    updated_at = now()
  WHERE user_id = me;

  RETURN jsonb_build_object(
    'rating', new_rating,
    'delta', new_rating - cur_rating,
    'leitner_box', new_box,
    'next_due_at', now() + due_interval
  );
END;
$$;
