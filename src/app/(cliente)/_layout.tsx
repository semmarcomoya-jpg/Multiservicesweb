import { Redirect } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import React from 'react';

import { Icon, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cartCount, useCart } from '@/lib/cart';
import { modOn, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function ClienteLayout() {
  const { session, loading } = useAuth();
  const { L } = useLang();
  const { data: stores } = useStores();
  const cart = useCart();
  const shop = (stores || []).some((st) => st.activo && modOn(st, 'shop'));
  const n = cartCount(cart);
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/bienvenida" />;
  const tab = (n: string) => ({ color }: { color: unknown }) => <Icon n={n} size={22} color={String(color)} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brown,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: '#EFE8DD', height: 74, paddingBottom: 10, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11 },
        sceneStyle: { backgroundColor: C.page },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: L('Inicio', 'Home'), tabBarIcon: tab('home') }} />
      <Tabs.Screen name="enviar" options={{ title: L('Enviar', 'Send'), tabBarIcon: tab('send') }} />
      <Tabs.Screen name="servicios" options={{ title: L('Servicios', 'Services'), tabBarIcon: tab('tool') }} />
      <Tabs.Screen name="productos" options={{ title: L('Tienda', 'Shop'), tabBarIcon: tab('bag'), href: shop ? undefined : null, tabBarBadge: n ? n : undefined }} />
      <Tabs.Screen name="pedidos" options={{ title: L('Pedidos', 'Orders'), tabBarIcon: tab('receipt'), href: null }} />
      <Tabs.Screen name="perfil" options={{ title: L('Perfil', 'Profile'), tabBarIcon: tab('user') }} />
    </Tabs>
  );
}
