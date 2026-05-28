-- 1. Remove client UPDATE on games entirely; server fns will use service role
DROP POLICY IF EXISTS "Participants update games" ON public.games;

-- 2. Replace overly broad profile UPDATE policy with allowlist (safe columns only)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

-- Revoke UPDATE on sensitive stat/identity columns; grant only on safe columns
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (username, country, last_active_at, is_guest) ON public.profiles TO authenticated;

CREATE POLICY "Users update own profile safe columns"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Lock down SECURITY DEFINER functions: only service_role may execute apply_elo
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, text) TO service_role;

-- find_or_join_match still needs to be called from the user's authenticated server fn
-- (it uses auth.uid()); keep that grant explicit.
REVOKE EXECUTE ON FUNCTION public.find_or_join_match(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_join_match(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_join_match(text, integer) TO service_role;

-- 4. Lock down realtime broadcast/presence by default
-- (Postgres-changes subscriptions still flow through each table's own RLS.)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'Deny all broadcast/presence by default'
  ) THEN
    CREATE POLICY "Deny all broadcast/presence by default"
    ON realtime.messages
    FOR SELECT
    TO authenticated, anon
    USING (false);
  END IF;
END $$;
