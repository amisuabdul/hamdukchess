
-- Profiles: restrict UPDATE to safe columns only via column-level grants
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, country, last_active_at, is_guest) ON public.profiles TO authenticated;

-- Friends: only addressee can update (accept/decline); requester can only delete via existing DELETE policy
DROP POLICY IF EXISTS "Participants update friendship" ON public.friends;
CREATE POLICY "Addressee updates friendship"
ON public.friends
FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);
