import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getUserId, resetSession, setUser } from './db';
import { supabase } from './supabase';

type Ctx = { session: Session | null; ready: boolean };
WebBrowser.maybeCompleteAuthSession();

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

/**
 * Google sign-in through Supabase OAuth in an in-app browser.
 * Returns to meapp://auth-callback with ?code=…, which we exchange for a session (PKCE).
 */
export async function signInWithGoogle(): Promise<{ error?: string; cancelled?: boolean }> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data?.url) return { error: error?.message ?? 'تعذّر فتح صفحة Google' };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { cancelled: true };
  const url = new URL(res.url);
  const code = url.searchParams.get('code');
  const errDesc = url.searchParams.get('error_description');
  if (errDesc) return { error: errDesc };
  if (!code) return { error: 'ما رجعش رمز الدخول من Google' };
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  return exErr ? { error: exErr.message } : {};
}

export async function signOut() {
  await supabase.auth.signOut();
}
