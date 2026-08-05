-- COACH PROFILES
CREATE TABLE public.coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  fide_title text,
  fide_elo integer,
  hourly_rate_kobo integer NOT NULL DEFAULT 500000,
  currency text NOT NULL DEFAULT 'NGN',
  languages text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  paystack_subaccount_code text,
  platform_fee_pct integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT false,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  sessions_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coach_profiles TO authenticated;
GRANT SELECT ON public.coach_profiles TO anon;
GRANT ALL ON public.coach_profiles TO service_role;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active coach profiles are public"
  ON public.coach_profiles FOR SELECT USING (is_active = true OR auth.uid() = user_id);
CREATE POLICY "Coaches create own profile"
  ON public.coach_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches update own profile"
  ON public.coach_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AVAILABILITY
CREATE TABLE public.coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);
CREATE INDEX coach_availability_coach_idx ON public.coach_availability(coach_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_availability TO authenticated;
GRANT SELECT ON public.coach_availability TO anon;
GRANT ALL ON public.coach_availability TO service_role;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability is public"
  ON public.coach_availability FOR SELECT USING (true);
CREATE POLICY "Coach manages own availability insert"
  ON public.coach_availability FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()));
CREATE POLICY "Coach manages own availability update"
  ON public.coach_availability FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()));
CREATE POLICY "Coach manages own availability delete"
  ON public.coach_availability FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()));

-- SESSIONS
CREATE TABLE public.coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 240),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','confirmed','completed','cancelled')),
  amount_kobo integer NOT NULL,
  platform_fee_kobo integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  paystack_reference text,
  meeting_url text,
  coach_notes text,
  student_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_sessions_coach_idx ON public.coach_sessions(coach_id, scheduled_at);
CREATE INDEX coach_sessions_student_idx ON public.coach_sessions(student_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE ON public.coach_sessions TO authenticated;
GRANT ALL ON public.coach_sessions TO service_role;
ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read sessions"
  ON public.coach_sessions FOR SELECT TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()));
CREATE POLICY "Students book sessions"
  ON public.coach_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Participants update sessions"
  ON public.coach_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()))
  WITH CHECK (auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.coach_profiles c WHERE c.id = coach_id AND c.user_id = auth.uid()));

-- REVIEWS
CREATE TABLE public.coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.coach_sessions(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_reviews_coach_idx ON public.coach_reviews(coach_id);
GRANT SELECT, INSERT, UPDATE ON public.coach_reviews TO authenticated;
GRANT SELECT ON public.coach_reviews TO anon;
GRANT ALL ON public.coach_reviews TO service_role;
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are public"
  ON public.coach_reviews FOR SELECT USING (true);
CREATE POLICY "Student reviews completed session"
  ON public.coach_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id AND EXISTS (
    SELECT 1 FROM public.coach_sessions s
    WHERE s.id = session_id AND s.student_id = auth.uid() AND s.status = 'completed'
  ));
CREATE POLICY "Student updates own review"
  ON public.coach_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- touch triggers
CREATE TRIGGER coach_profiles_touch BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER coach_availability_touch BEFORE UPDATE ON public.coach_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER coach_sessions_touch BEFORE UPDATE ON public.coach_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER coach_reviews_touch BEFORE UPDATE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- rating rollup
CREATE OR REPLACE FUNCTION public.recompute_coach_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coach_profiles c SET
    avg_rating = COALESCE((SELECT round(avg(r.rating)::numeric, 2) FROM public.coach_reviews r WHERE r.coach_id = c.id), 0),
    rating_count = (SELECT count(*) FROM public.coach_reviews r WHERE r.coach_id = c.id)
  WHERE c.id = COALESCE(NEW.coach_id, OLD.coach_id);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_coach_rating() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER coach_reviews_rollup AFTER INSERT OR UPDATE OR DELETE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_coach_rating();