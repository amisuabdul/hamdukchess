ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_org BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  monthly_limit INTEGER NOT NULL DEFAULT 10000,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.api_usage (
  id BIGSERIAL PRIMARY KEY,
  key_id UUID NOT NULL REFERENCES public.api_keys ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX api_usage_key_created_idx ON public.api_usage (key_id, created_at DESC);
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_owner_id, user_id)
);
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  key_id UUID REFERENCES public.api_keys ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  failure_count INTEGER NOT NULL DEFAULT 0,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_webhooks TO service_role;
ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.api_webhooks ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  attempt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  error TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_retry_idx ON public.webhook_deliveries (status, next_retry_at);
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'swiss',
  time_control TEXT NOT NULL DEFAULT '5+0',
  rounds INTEGER NOT NULL DEFAULT 5,
  current_round INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.org_tournaments TO service_role;
ALTER TABLE public.org_tournaments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.org_tournaments ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  tiebreak NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX org_tournament_players_t_idx ON public.org_tournament_players (tournament_id);
GRANT ALL ON public.org_tournament_players TO service_role;
ALTER TABLE public.org_tournament_players ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.embed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  key_id UUID NOT NULL REFERENCES public.api_keys ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  kind TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.embed_tokens TO service_role;
ALTER TABLE public.embed_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  key_id UUID REFERENCES public.api_keys ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Class session',
  position_fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_session_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Student',
  board_fen TEXT,
  moves_made INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX class_session_students_s_idx ON public.class_session_students (session_id);
GRANT ALL ON public.class_session_students TO service_role;
ALTER TABLE public.class_session_students ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER api_webhooks_touch BEFORE UPDATE ON public.api_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER org_tournaments_touch BEFORE UPDATE ON public.org_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER class_sessions_touch BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();