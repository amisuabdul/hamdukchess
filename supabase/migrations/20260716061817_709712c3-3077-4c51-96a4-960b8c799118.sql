
DO $$ BEGIN
  CREATE TYPE public.video_source_enum AS ENUM ('youtube','vimeo','cloud');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.video_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  source public.video_source_enum NOT NULL,
  external_id TEXT,
  storage_path TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  instructor TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (source IN ('youtube','vimeo') AND external_id IS NOT NULL) OR
    (source = 'cloud' AND storage_path IS NOT NULL)
  )
);

GRANT SELECT ON public.video_lessons TO anon;
GRANT SELECT ON public.video_lessons TO authenticated;
GRANT ALL ON public.video_lessons TO service_role;

ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published lessons"
  ON public.video_lessons FOR SELECT
  USING (published = true);

CREATE INDEX IF NOT EXISTS idx_video_lessons_category ON public.video_lessons(category, sort_order);

CREATE TABLE IF NOT EXISTS public.user_video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.video_lessons(id) ON DELETE CASCADE,
  position_sec INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_video_progress TO authenticated;
GRANT ALL ON public.user_video_progress TO service_role;

ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own video progress"
  ON public.user_video_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own video progress"
  ON public.user_video_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own video progress"
  ON public.user_video_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own video progress"
  ON public.user_video_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_video_lessons_updated_at
  BEFORE UPDATE ON public.video_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_user_video_progress_updated_at
  BEFORE UPDATE ON public.user_video_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.video_lessons (title, description, category, difficulty, source, external_id, duration_sec, thumbnail_url, instructor, is_premium, sort_order) VALUES
('How To Play Chess: Complete Beginner Guide','Learn all the rules of chess in one video.','Fundamentals','beginner','youtube','fKxG8KjH1Qg',749,'https://i.ytimg.com/vi/fKxG8KjH1Qg/hqdefault.jpg','GothamChess',false,1),
('The 4 Most Important Chess Principles','Core opening and middlegame principles every beginner must master.','Fundamentals','beginner','youtube','21actIssZ5s',780,'https://i.ytimg.com/vi/21actIssZ5s/hqdefault.jpg','ChessNetwork',false,2),
('Basic Opening Principles','Control the center, develop pieces, castle early.','Openings','beginner','youtube','8IlJ3v8I4Z0',600,'https://i.ytimg.com/vi/8IlJ3v8I4Z0/hqdefault.jpg','Saint Louis Chess Club',false,3),
('The Italian Game — Complete Guide','A classical opening perfect for club players.','Openings','intermediate','youtube','LU_00buHFyM',1200,'https://i.ytimg.com/vi/LU_00buHFyM/hqdefault.jpg','Hanging Pawns',false,4),
('The London System','Solid, safe, and easy to learn.','Openings','beginner','youtube','fzYbjK9r5xM',900,'https://i.ytimg.com/vi/fzYbjK9r5xM/hqdefault.jpg','GothamChess',false,5),
('10 Tactical Motifs Every Player Must Know','Forks, pins, skewers, discovered attacks, and more.','Tactics','beginner','youtube','8mVUOhx7-2c',1080,'https://i.ytimg.com/vi/8mVUOhx7-2c/hqdefault.jpg','ChessCoach',false,6),
('Advanced Tactical Patterns','Deep combinations from master games.','Tactics','advanced','youtube','8p_QW0mLj_A',1500,'https://i.ytimg.com/vi/8p_QW0mLj_A/hqdefault.jpg','ChessMaster',true,7),
('King and Pawn Endgames','Master the fundamentals of pawn endings.','Endgames','intermediate','youtube','5S6uu6Ejrb0',960,'https://i.ytimg.com/vi/5S6uu6Ejrb0/hqdefault.jpg','Saint Louis Chess Club',false,8),
('Rook Endgames: Lucena and Philidor','Two positions every serious player must know.','Endgames','advanced','youtube','2ZM3S8JQx8k',1140,'https://i.ytimg.com/vi/2ZM3S8JQx8k/hqdefault.jpg','ChessCoach',true,9),
('Positional Chess: Weak Squares','Learn to identify and exploit weak squares.','Strategy','intermediate','youtube','7XeJ1D1p2Yg',1320,'https://i.ytimg.com/vi/7XeJ1D1p2Yg/hqdefault.jpg','Hanging Pawns',false,10),
('How to Analyze Your Own Games','A practical framework for improvement.','Improvement','intermediate','youtube','wG_iN2VGl3s',840,'https://i.ytimg.com/vi/wG_iN2VGl3s/hqdefault.jpg','ChessCoach',false,11),
('Chess Psychology: Playing Under Pressure','Managing time and nerves in tournament play.','Improvement','advanced','youtube','Xy-x3iX4Y0M',720,'https://i.ytimg.com/vi/Xy-x3iX4Y0M/hqdefault.jpg','GothamChess',true,12);

CREATE POLICY "Authenticated users read lesson videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos');
