import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
};

function deriveIsGuest(user: User | null): boolean {
  if (!user) return false;
  // Supabase marks anonymous users with is_anonymous=true and app_metadata.provider='anonymous'
  return Boolean(
    (user as unknown as { is_anonymous?: boolean }).is_anonymous ||
      user.app_metadata?.provider === "anonymous",
  );
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true, isGuest: false });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState({ user, session, loading: false, isGuest: deriveIsGuest(user) });
    });
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setState({ user, session: data.session, loading: false, isGuest: deriveIsGuest(user) });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function signInAsGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

/**
 * Bind email/password to an existing anonymous user, preserving id + stats.
 * Caller should refresh profile UI after success.
 */
export async function upgradeGuestAccount(email: string, password: string, username?: string) {
  // 1. Attach email + password to current anon user
  const { error: updateErr } = await supabase.auth.updateUser({
    email,
    password,
    data: username ? { username } : undefined,
  });
  if (updateErr) throw updateErr;

  // 2. Flip is_guest flag on profile (and optionally username)
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (uid) {
    const patch: Record<string, unknown> = { is_guest: false };
    if (username) patch.username = username;
    await supabase.from("profiles").update(patch).eq("id", uid);
  }
}
