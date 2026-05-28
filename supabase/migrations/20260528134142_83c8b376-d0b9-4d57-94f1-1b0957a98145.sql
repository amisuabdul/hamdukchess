-- Subscription tier enum
DO $$ BEGIN
  CREATE TYPE public.subscription_tier_enum AS ENUM ('free','plus','gold');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier_enum NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

-- Update new-user handler to mark anonymous signups as guests
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  base_name text;
  final_name text;
  counter int := 0;
  is_anon boolean := coalesce((new.raw_app_meta_data->>'provider') = 'anonymous', new.email is null);
begin
  if is_anon then
    base_name := 'guest_' || substr(replace(new.id::text,'-',''), 1, 8);
  else
    base_name := coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1),
      'player'
    );
    base_name := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
    if length(base_name) < 3 then base_name := 'player' || substr(new.id::text, 1, 6); end if;
  end if;
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    counter := counter + 1;
    final_name := base_name || counter::text;
  end loop;
  insert into public.profiles (id, username, is_guest)
  values (new.id, final_name, is_anon);
  return new;
end;
$function$;
