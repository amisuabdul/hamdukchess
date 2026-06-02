
-- Extend games with variant, clocks, offers
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS chess960_start_fen text,
  ADD COLUMN IF NOT EXISTS initial_sec integer,
  ADD COLUMN IF NOT EXISTS increment_sec integer,
  ADD COLUMN IF NOT EXISTS time_white_ms integer,
  ADD COLUMN IF NOT EXISTS time_black_ms integer,
  ADD COLUMN IF NOT EXISTS last_clock_update timestamptz,
  ADD COLUMN IF NOT EXISTS draw_offer_by uuid,
  ADD COLUMN IF NOT EXISTS draw_offer_at timestamptz,
  ADD COLUMN IF NOT EXISTS takeback_offer_by uuid,
  ADD COLUMN IF NOT EXISTS takeback_offer_at timestamptz,
  ADD COLUMN IF NOT EXISTS rated boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT games_variant_check CHECK (variant IN ('standard','chess960'));

-- Backfill clocks from time_control for existing rows
UPDATE public.games
SET initial_sec = COALESCE(initial_sec, (split_part(time_control,'+',1))::int * 60),
    increment_sec = COALESCE(increment_sec, (split_part(time_control,'+',2))::int),
    time_white_ms = COALESCE(time_white_ms, (split_part(time_control,'+',1))::int * 60 * 1000),
    time_black_ms = COALESCE(time_black_ms, (split_part(time_control,'+',1))::int * 60 * 1000),
    last_clock_update = COALESCE(last_clock_update, last_move_at)
WHERE initial_sec IS NULL;

-- Profiles: review flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

-- Append-only event log
CREATE TABLE IF NOT EXISTS public.game_events (
  id bigserial PRIMARY KEY,
  game_id uuid NOT NULL,
  type text NOT NULL,
  by_user uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_events_game ON public.game_events(game_id, id);

GRANT SELECT ON public.game_events TO anon, authenticated;
GRANT ALL ON public.game_events TO service_role;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events readable by all" ON public.game_events FOR SELECT USING (true);

-- Move timing telemetry (anti-cheat)
CREATE TABLE IF NOT EXISTS public.move_telemetry (
  id bigserial PRIMARY KEY,
  game_id uuid NOT NULL,
  ply integer NOT NULL,
  user_id uuid NOT NULL,
  elapsed_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_move_telemetry_game ON public.move_telemetry(game_id);
CREATE INDEX IF NOT EXISTS idx_move_telemetry_user ON public.move_telemetry(user_id);

GRANT SELECT ON public.move_telemetry TO authenticated;
GRANT ALL ON public.move_telemetry TO service_role;
ALTER TABLE public.move_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own telemetry" ON public.move_telemetry
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Realtime for game_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;

-- Updated find_or_join_match supporting variant
DROP FUNCTION IF EXISTS public.find_or_join_match(text, integer);
CREATE OR REPLACE FUNCTION public.find_or_join_match(
  p_time_control text,
  p_rating_window integer DEFAULT 200,
  p_variant text DEFAULT 'standard',
  p_start_fen text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  my_rating int;
  opponent uuid;
  new_game_id uuid;
  white uuid; black uuid;
  init_sec int := (split_part(p_time_control,'+',1))::int * 60;
  inc_sec int := (split_part(p_time_control,'+',2))::int;
  start_fen text := COALESCE(p_start_fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
begin
  if me is null then raise exception 'not authenticated'; end if;
  select rating into my_rating from public.profiles where id = me;
  select user_id into opponent
  from public.matchmaking_queue
  where time_control = (p_variant || ':' || p_time_control)
    and user_id <> me
    and abs(rating - my_rating) <= p_rating_window
  order by joined_at asc
  for update skip locked
  limit 1;
  if opponent is null then
    insert into public.matchmaking_queue (user_id, time_control, rating)
    values (me, p_variant || ':' || p_time_control, my_rating)
    on conflict (user_id) do update set time_control = excluded.time_control, rating = excluded.rating, joined_at = now();
    return null;
  end if;
  if random() < 0.5 then white := me; black := opponent;
  else white := opponent; black := me; end if;
  insert into public.games (
    white_id, black_id, time_control, variant, chess960_start_fen,
    initial_sec, increment_sec, time_white_ms, time_black_ms,
    last_clock_update, fen
  )
  values (
    white, black, p_time_control, p_variant,
    case when p_variant = 'chess960' then start_fen else null end,
    init_sec, inc_sec, init_sec * 1000, init_sec * 1000,
    now(), start_fen
  )
  returning id into new_game_id;
  delete from public.matchmaking_queue where user_id in (me, opponent);
  return new_game_id;
end;
$function$;
