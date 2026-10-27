import { Redirect } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import React from 'react';

import { Icon, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function ClienteLayout() {
  const { session, loading } = useAuth();
  const { L } = useLang();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/bienvenida" />;
  const tab = (n: string) => ({ color }: { color: unknown }) => <Icon n={n} size={22} color={String(color)} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brown,
        tabBarInactiveTintColor: C.softInk,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontWeight: '800', fontSize: 12 },
        sceneStyle: { backgroundColor: C.page },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: L('Inicio', 'Home'), tabBarIcon: tab('home') }} />
      <Tabs.Screen name="enviar" options={{ title: L('Enviar', 'Send'), tabBarIcon: tab('send') }} />
      <Tabs.Screen name="servicios" options={{ title: L('Servicios', 'Services'), tabBarIcon: tab('tool') }} />
      <Tabs.Screen name="pedidos" options={{ title: L('Pedidos', 'Orders'), tabBarIcon: tab('receipt') }} />
      <Tabs.Screen name="perfil" options={{ title: L('Perfil', 'Profile'), tabBarIcon: tab('user') }} />
    </Tabs>
  );
}
