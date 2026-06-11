import { supabase, isSupabaseEnabled } from "./client";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: data.user.user_metadata?.full_name ?? null,
  };
}

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: displayName } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign up failed — no user returned");
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: displayName ?? null,
  };
}

export async function signOut(): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.full_name ?? null,
  };
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  if (!isSupabaseEnabled() || !supabase) {
    callback(null);
    return { unsubscribe: () => {} };
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email ?? null,
        displayName: session.user.user_metadata?.full_name ?? null,
      });
    } else {
      callback(null);
    }
  });
  return { unsubscribe: () => subscription.unsubscribe() };
}
