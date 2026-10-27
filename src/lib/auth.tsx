import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { errMsg, supabase, supabaseConfigured } from './supabase';
import type { Profile } from './types';

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  /** Error al leer el perfil (por ejemplo, la base de datos aún no tiene las tablas). */
  profileError: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    setProfileError('');
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) {
      setProfile(null);
      setProfileError(errMsg(error));
      return;
    }
    if (data) {
      setProfile(data as Profile);
      return;
    }
    // La cuenta existe pero no tiene perfil (se creó antes de correr el SQL): lo creamos.
    const r = await supabase.rpc('ensure_profile').single<Profile>();
    if (r.error) {
      setProfile(null);
      setProfileError(errMsg(r.error));
    } else setProfile(r.data);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      // No esperar aquí (Supabase recomienda no hacer llamadas dentro del aviso)
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      profile,
      profileError,
      loading,
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, profileError, loading, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
