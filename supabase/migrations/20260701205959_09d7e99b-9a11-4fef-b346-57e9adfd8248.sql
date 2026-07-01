
-- 1) profiles: column-level restriction. Sensitive billing/moderation columns
--    should only be readable by the service role (and thus by server functions
--    acting on the owner's behalf).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, country, rating, games_played, wins, losses, draws,
  created_at, is_guest, last_active_at
) ON public.profiles TO anon, authenticated;

-- 2) matchmaking_queue: users may only read their own row
DROP POLICY IF EXISTS "Queue readable by authenticated" ON public.matchmaking_queue;
CREATE POLICY "Users read own queue entry"
  ON public.matchmaking_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) find_or_join_match: clamp p_rating_window so direct RPC calls can't widen it
CREATE OR REPLACE FUNCTION public.find_or_join_match(
  p_time_control text,
  p_rating_window integer DEFAULT 200,
  p_variant text DEFAULT 'standard'::text,
  p_start_fen text DEFAULT NULL::text,
  p_region text DEFAULT 'africa-west-1'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  my_tier subscription_tier_enum;
  my_priority boolean;
  my_rating int;
  opponent uuid;
  new_game_id uuid;
  white uuid; black uuid;
  init_sec int := (split_part(p_time_control,'+',1))::int * 60;
  inc_sec  int := (split_part(p_time_control,'+',2))::int;
  start_fen text := COALESCE(p_start_fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  white_r int; black_r int;
  window_clamped int := LEAST(GREATEST(COALESCE(p_rating_window, 200), 50), 200);
begin
  if me is null then raise exception 'not authenticated'; end if;

  select subscription_tier into my_tier from public.profiles where id = me;
  my_priority := (my_tier = 'gold');

  select rating into my_rating
    from public.ratings
    where user_id = me and time_control = p_time_control and variant = p_variant;
  if my_rating is null then
    insert into public.ratings (user_id, time_control, variant)
    values (me, p_time_control, p_variant)
    on conflict do nothing;
    my_rating := 1200;
  end if;

  select q.user_id into opponent
  from public.matchmaking_queue q
  left join public.ratings r
    on r.user_id = q.user_id
   and r.time_control = p_time_control
   and r.variant = p_variant
  where q.time_control = p_time_control
    and q.variant = p_variant
    and q.user_id <> me
    and abs(coalesce(r.rating, 1200) - my_rating) <= window_clamped
  order by q.is_priority desc, q.joined_at asc
  for update skip locked
  limit 1;

  if opponent is null then
    insert into public.matchmaking_queue (user_id, time_control, variant, region, rating, is_priority)
    values (me, p_time_control, p_variant, p_region, my_rating, my_priority)
    on conflict (user_id) do update
      set time_control = excluded.time_control,
          variant = excluded.variant,
          region = excluded.region,
          rating = excluded.rating,
          is_priority = excluded.is_priority,
          joined_at = now();
    return null;
  end if;

  if random() < 0.5 then white := me; black := opponent;
  else white := opponent; black := me; end if;

  select rating into white_r from public.ratings
    where user_id = white and time_control = p_time_control and variant = p_variant;
  select rating into black_r from public.ratings
    where user_id = black and time_control = p_time_control and variant = p_variant;

  insert into public.games (
    white_id, black_id, time_control, variant, chess960_start_fen,
    initial_sec, increment_sec, time_white_ms, time_black_ms,
    last_clock_update, fen, region,
    white_rating_before, black_rating_before
  )
  values (
    white, black, p_time_control, p_variant,
    case when p_variant = 'chess960' then start_fen else null end,
    init_sec, inc_sec, init_sec * 1000, init_sec * 1000,
    now(), start_fen, p_region,
    coalesce(white_r, 1200), coalesce(black_r, 1200)
  )
  returning id into new_game_id;

  delete from public.matchmaking_queue where user_id in (me, opponent);
  return new_game_id;
end;
$function$;

-- 4) Revoke EXECUTE from anon on all SECURITY DEFINER functions. They all
--    require auth.uid(), so anon calls are meaningless and only broaden attack surface.
REVOKE EXECUTE ON FUNCTION public.find_or_join_match(text, integer, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_or_join_match(text, integer, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text, text, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.submit_puzzle_attempt(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_bot_game(text, text) FROM anon, authenticated, public;

-- Re-grant to authenticated where user-callable is required
GRANT EXECUTE ON FUNCTION public.find_or_join_match(text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_join_match(text, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_puzzle_attempt(uuid, boolean) TO authenticated;

-- record_bot_game and apply_elo are service_role-only
GRANT EXECUTE ON FUNCTION public.record_bot_game(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text, text, text, uuid) TO service_role;
