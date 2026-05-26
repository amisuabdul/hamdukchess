
-- Tighten moves INSERT policy: must be a participant of an active game
DROP POLICY IF EXISTS "Players insert own moves" ON public.moves;
CREATE POLICY "Participants insert moves in active games"
ON public.moves
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = by_user
  AND EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.id = moves.game_id
      AND g.status = 'active'
      AND (g.white_id = auth.uid() OR g.black_id = auth.uid())
  )
);

-- Restrict apply_elo to service_role only (called from server fn via admin client)
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) TO service_role;
