import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { PanelFrame } from '@/components/panel';
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
      <PanelFrame kind="tienda">
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: C.page } }} />
      </PanelFrame>
    </StaffShell>
  );
}
