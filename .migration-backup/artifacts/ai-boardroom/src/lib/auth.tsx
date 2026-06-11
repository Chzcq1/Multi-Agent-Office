import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  supabaseEnabled: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  supabaseEnabled: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseEnabled = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }

    let unsubscribe = () => {};

    import("@workspace/supabase").then(({ onAuthStateChange, getCurrentUser }) => {
      getCurrentUser().then((u) => {
        setUser(u);
        setLoading(false);
      });

      const sub = onAuthStateChange((u) => setUser(u));
      unsubscribe = sub.unsubscribe;
    });

    return () => unsubscribe();
  }, [supabaseEnabled]);

  async function signOut() {
    if (!supabaseEnabled) return;
    const { signOut: supabaseSignOut } = await import("@workspace/supabase");
    await supabaseSignOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, supabaseEnabled, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
