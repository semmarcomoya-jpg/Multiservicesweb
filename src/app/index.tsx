import { Redirect } from 'expo-router';
import React from 'react';

import { Loading, Note, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

/** Decide a dónde va cada quien al abrir la app. */
export default function Index() {
  const { session, profile, loading } = useAuth();
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
  if (!profile) return <Loading />;
  if (profile.role === 'admin') return <Redirect href="/admin" />;
  if (profile.role === 'tienda') return <Redirect href="/tienda" />;
  return <Redirect href="/inicio" />;
}
