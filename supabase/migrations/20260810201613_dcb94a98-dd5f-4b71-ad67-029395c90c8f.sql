-- ============ Shared study boards ============
CREATE TABLE public.study_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled study',
  start_fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  start_pgn TEXT,
  current_pgn TEXT NOT NULL DEFAULT '',
  current_fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  collaborators UUID[] NOT NULL DEFAULT '{}',
  annotations JSONB NOT NULL DEFAULT '{}'::jsonb,
  shapes JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_boards TO authenticated;
GRANT SELECT ON public.study_boards TO anon;
GRANT ALL ON public.study_boards TO service_role;
ALTER TABLE public.study_boards ENABLE ROW LEVEL SECURITY;

CREATE INDEX study_boards_owner_idx ON public.study_boards(owner_id);
CREATE INDEX study_boards_collab_idx ON public.study_boards USING gin (collaborators);

CREATE OR REPLACE FUNCTION public.can_edit_study(_board_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_boards b
    WHERE b.id = _board_id
      AND (b.owner_id = _user_id OR _user_id = ANY (b.collaborators))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_study(_board_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_boards b
    WHERE b.id = _board_id
      AND (
        b.visibility IN ('shared','public')
        OR b.owner_id = _user_id
        OR _user_id = ANY (b.collaborators)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_edit_study(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_study(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_study(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_study(uuid, uuid) TO authenticated, anon, service_role;

CREATE POLICY "Owners manage their studies"
  ON public.study_boards FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Collaborators and viewers can read studies"
  ON public.study_boards FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR auth.uid() = ANY (collaborators)
    OR visibility IN ('shared','public')
  );

CREATE POLICY "Anonymous can read link-shared and public studies"
  ON public.study_boards FOR SELECT TO anon
  USING (visibility IN ('shared','public'));

CREATE POLICY "Collaborators can edit studies"
  ON public.study_boards FOR UPDATE TO authenticated
  USING (auth.uid() = ANY (collaborators))
  WITH CHECK (auth.uid() = ANY (collaborators));

CREATE TRIGGER study_boards_touch BEFORE UPDATE ON public.study_boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Snapshots ============
CREATE TABLE public.study_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.study_boards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_snapshots TO authenticated;
GRANT SELECT ON public.study_snapshots TO anon;
GRANT ALL ON public.study_snapshots TO service_role;
ALTER TABLE public.study_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX study_snapshots_board_idx ON public.study_snapshots(board_id);

CREATE POLICY "Viewers can read snapshots"
  ON public.study_snapshots FOR SELECT TO authenticated
  USING (public.can_view_study(board_id, auth.uid()));

CREATE POLICY "Anonymous can read snapshots of shared studies"
  ON public.study_snapshots FOR SELECT TO anon
  USING (public.can_view_study(board_id, NULL));

CREATE POLICY "Editors can create snapshots"
  ON public.study_snapshots FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_edit_study(board_id, auth.uid()));

CREATE POLICY "Editors can delete snapshots"
  ON public.study_snapshots FOR DELETE TO authenticated
  USING (public.can_edit_study(board_id, auth.uid()));

-- ============ Study chat ============
CREATE TABLE public.study_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.study_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.study_chat TO authenticated;
GRANT ALL ON public.study_chat TO service_role;
ALTER TABLE public.study_chat ENABLE ROW LEVEL SECURITY;
CREATE INDEX study_chat_board_idx ON public.study_chat(board_id, created_at DESC);

CREATE POLICY "Collaborators can read study chat"
  ON public.study_chat FOR SELECT TO authenticated
  USING (public.can_edit_study(board_id, auth.uid()));

CREATE POLICY "Collaborators can post study chat"
  ON public.study_chat FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_edit_study(board_id, auth.uid()));

CREATE POLICY "Authors can delete their study chat"
  ON public.study_chat FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ Correspondence + spectator on games ============
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_correspondence BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS days_per_move INTEGER,
  ADD COLUMN IF NOT EXISTS move_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_by_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS spectator_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS games_correspondence_deadline_idx
  ON public.games(move_deadline) WHERE is_correspondence AND status = 'active';

-- ============ Vacation mode + email prefs ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vacation_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vacation_days_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vacation_year INTEGER,
  ADD COLUMN IF NOT EXISTS email_notify_moves BOOLEAN NOT NULL DEFAULT true;

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_chat;