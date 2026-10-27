import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { PanelFrame } from '@/components/panel';
import { StaffShell } from '@/components/StaffShell';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

export default function AdminLayout() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <Loading />;
  if (!session) return <Redirect href="/entrar" />;
  if (profile?.role !== 'admin') return <Redirect href="/" />;
  return (
    <StaffShell kind="admin">
      <PanelFrame kind="admin">
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: C.page } }} />
      </PanelFrame>
    </StaffShell>
  );
}
