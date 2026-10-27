import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { StaffShell } from '@/components/StaffShell';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

export default function TiendaLayout() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <Loading />;
  if (!session) return <Redirect href="/entrar" />;
  if (profile?.role !== 'tienda' && profile?.role !== 'admin') return <Redirect href="/" />;
  return (
    <StaffShell kind="tienda">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.page } }} />
    </StaffShell>
  );
}
