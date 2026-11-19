import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getUserId, resetSession, setUser } from './db';
import { supabase } from './supabase';

type Ctx = { session: Session | null; ready: boolean };
const AuthCtx = createContext<Ctx>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await setUser(data.session?.user.id ?? null);
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if ((s?.user.id ?? null) !== getUserId()) {
        resetSession();
        await setUser(s?.user.id ?? null);
      }
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthCtx.Provider value={{ session, ready }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

export async function signOut() {
  await supabase.auth.signOut();
}
