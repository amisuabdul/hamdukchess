
CREATE TABLE public.puzzle_storm_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  solved integer NOT NULL DEFAULT 0,
  mistakes integer NOT NULL DEFAULT 0,
  duration_sec integer NOT NULL DEFAULT 180,
  mode text NOT NULL DEFAULT '3min',
  played_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.puzzle_storm_scores TO anon;
GRANT SELECT, INSERT ON public.puzzle_storm_scores TO authenticated;
GRANT ALL ON public.puzzle_storm_scores TO service_role;

ALTER TABLE public.puzzle_storm_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storm scores readable by all"
  ON public.puzzle_storm_scores FOR SELECT
  USING (true);

CREATE POLICY "Users insert own storm scores"
  ON public.puzzle_storm_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_storm_scores_user_played ON public.puzzle_storm_scores (user_id, played_at DESC);
CREATE INDEX idx_storm_scores_score ON public.puzzle_storm_scores (score DESC, played_at DESC);
