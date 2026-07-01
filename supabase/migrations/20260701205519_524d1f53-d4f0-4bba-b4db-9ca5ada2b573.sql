
CREATE TABLE public.game_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL UNIQUE REFERENCES public.games(id) ON DELETE CASCADE,
  depth INT NOT NULL,
  eval_per_ply JSONB NOT NULL,
  classifications JSONB NOT NULL,
  accuracy_white NUMERIC(5,2),
  accuracy_black NUMERIC(5,2),
  opening_eco TEXT,
  opening_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.game_analysis TO authenticated;
GRANT SELECT ON public.game_analysis TO anon;
GRANT ALL ON public.game_analysis TO service_role;

ALTER TABLE public.game_analysis ENABLE ROW LEVEL SECURITY;

-- Public read (games are public in this app)
CREATE POLICY "Anyone can read game analysis"
  ON public.game_analysis FOR SELECT
  USING (true);

-- Only participants may insert an analysis for a completed game
CREATE POLICY "Participants insert analysis for completed games"
  ON public.game_analysis FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id
        AND g.status = 'completed'
        AND (g.white_id = auth.uid() OR g.black_id = auth.uid())
    )
  );

CREATE INDEX idx_game_analysis_game_id ON public.game_analysis(game_id);
