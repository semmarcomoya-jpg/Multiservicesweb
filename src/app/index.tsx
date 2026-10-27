import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Btn, H1, Loading, Note, P, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { supabaseConfigured } from '@/lib/supabase';

/** Decide a dónde va cada quien al abrir la app. */
export default function Index() {
  const { L } = useLang();
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!supabaseConfigured) {
    return (
      <Screen>
        <Note kind="red" icon="shield">
          Falta configurar Supabase: crea el archivo .env con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver README).
        </Note>
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/bienvenida" />;
  if (!profile) {
    if (profileError || slow) {
      const missingDb = /relation|does not exist|schema cache|ensure_profile|404|PGRST/i.test(profileError);
      return (
        <Screen wall="profile">
          <H1>{L('No pudimos abrir tu cuenta', "We couldn't open your account")}</H1>
          <Note kind="red" icon="shield">
            {missingDb
              ? L('La base de datos todavía no está lista. El administrador debe correr el SQL en Supabase (SQL Editor) y volver a intentar.', 'The database is not ready yet. The administrator must run the SQL in Supabase (SQL Editor) and try again.')
              : profileError || L('La conexión está tardando. Revisa tu internet e intenta de nuevo.', 'The connection is slow. Check your internet and try again.')}
          </Note>
          {profileError ? <P small>{L('Detalle: ', 'Detail: ') + profileError}</P> : null}
          <Btn title={L('Intentar de nuevo', 'Try again')} onPress={() => refreshProfile()} />
          <Btn kind="ghost" title={L('Cerrar sesión', 'Sign out')} onPress={async () => { await signOut(); router.replace('/bienvenida'); }} />
        </Screen>
      );
    }
    return <Loading />;
  }
  // El superusuario entra a la app como cliente (igual que la maqueta) y cambia de vista con el selector de arriba
  if (profile.role === 'tienda') return <Redirect href="/tienda" />;
  return <Redirect href="/inicio" />;
}
