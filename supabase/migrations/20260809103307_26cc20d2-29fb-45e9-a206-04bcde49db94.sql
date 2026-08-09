CREATE TYPE public.admin_role_enum AS ENUM ('super_admin','admin','moderator','support');

CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.admin_role_enum NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_roles TO authenticated;
GRANT ALL ON public.admin_roles TO service_role;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read their own role row"
ON public.admin_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages admin roles"
ON public.admin_roles FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS public.admin_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_roles WHERE user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(min_role text DEFAULT 'support')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (CASE (SELECT role FROM public.admin_roles WHERE user_id = auth.uid())
       WHEN 'super_admin' THEN 4 WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 WHEN 'support' THEN 1 ELSE 0 END)
    >=
    (CASE min_role
       WHEN 'super_admin' THEN 4 WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 WHEN 'support' THEN 1 ELSE 1 END),
    false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated, service_role;

CREATE TABLE public.admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_table, target_id);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read the audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.is_admin('support'));

CREATE POLICY "Service role writes the audit log"
ON public.admin_audit_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read their own reports"
ON public.reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.is_admin('moderator'));

CREATE POLICY "Service role manages reports"
ON public.reports FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

CREATE INDEX IF NOT EXISTS games_flagged_idx ON public.games (flagged_for_review, created_at DESC);