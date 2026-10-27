import { router, usePathname } from 'expo-router';
import React, { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, LangToggle, Row } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Store } from '@/lib/types';

// Tienda que el administrador está viendo en modo tienda (las cuentas de tienda ven siempre la suya)
let adminStore: string | null = null;
const subs = new Set<() => void>();
export const setAdminStore = (id: string) => {
  adminStore = id;
  subs.forEach((f) => f());
};
export const useAdminStore = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => adminStore,
    () => adminStore,
  );

/** Tienda activa del panel según el rol. */
export function usePanelStore(stores: Store[] | null) {
  const { profile } = useAuth();
  const sel = useAdminStore();
  if (!stores || !profile) return null;
  if (profile.role === 'tienda') return stores.find((s) => s.id === profile.store_id) || null;
  return stores.find((s) => s.id === sel) || stores[0] || null;
}

export function PanelHeader({ kind, store, stores }: { kind: 'tienda' | 'admin'; store?: Store | null; stores?: Store[] | null }) {
  const { L } = useLang();
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const links =
    kind === 'tienda'
      ? [
          ['/tienda', L('Pedidos', 'Orders'), 'receipt'],
          ['/tienda/ajustes', L('Mi tienda', 'My store'), 'store'],
        ]
      : [
          ['/admin', L('Ventas', 'Sales'), 'chart'],
          ['/admin/servicios', L('Servicios', 'Services'), 'tool'],
          ['/admin/tiendas', L('Tiendas', 'Stores'), 'store'],
          ['/admin/cambio', L('Tipo de cambio y reglas', 'Rate & rules'), 'cash'],
          ['/admin/empleados', L('Empleados', 'Staff'), 'users'],
          ['/admin/usuarios', L('Cuentas', 'Accounts'), 'id'],
        ];
  return (
    <View style={{ gap: 10 }}>
      <View style={{ backgroundColor: C.brownDark, borderRadius: R.lg, padding: 14, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{kind === 'tienda' ? L('Modo tienda', 'Store mode') : L('Administración', 'Administration')}</Text>
            {store && kind === 'tienda' ? (
              <View style={{ backgroundColor: C.gold, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontWeight: '900', color: C.ink, fontSize: 12 }}>{store.nombre}</Text>
              </View>
            ) : null}
          </Row>
          <Row gap={8}>
            <LangToggle />
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await signOut();
                router.replace('/bienvenida');
              }}
              style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Salir', 'Sign out')}</Text>
            </Pressable>
          </Row>
        </Row>
        {kind === 'tienda' && profile?.role === 'admin' && stores ? (
          <Row gap={6}>
            {stores.map((st) => (
              <Pressable key={st.id} accessibilityRole="radio" accessibilityState={{ checked: store?.id === st.id }} onPress={() => setAdminStore(st.id)}
                style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: R.pill, backgroundColor: store?.id === st.id ? C.gold : 'rgba(255,255,255,0.12)' }}>
                <Text style={{ fontWeight: '800', color: store?.id === st.id ? C.ink : '#fff' }}>{st.nombre.replace('Castillo · ', '')}</Text>
              </Pressable>
            ))}
          </Row>
        ) : null}
      </View>
      <Row gap={6}>
        {links.map(([href, label, ic]) => {
          const on = path === href;
          return (
            <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(href as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: R.pill, backgroundColor: on ? C.ink : C.card, borderWidth: 1, borderColor: on ? C.ink : C.line }}>
              <Icon n={ic} size={16} color={on ? '#fff' : C.softInk} />
              <Text style={{ fontWeight: '800', color: on ? '#fff' : C.softInk }}>{label}</Text>
            </Pressable>
          );
        })}
        {profile?.role === 'admin' ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace((kind === 'tienda' ? '/admin' : '/tienda') as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: R.pill, backgroundColor: C.goldSoft }}>
            <Icon n={kind === 'tienda' ? 'lock' : 'store'} size={16} color={C.goldInk} />
            <Text style={{ fontWeight: '800', color: C.goldInk }}>{kind === 'tienda' ? L('Ir a administración', 'Go to admin') : L('Ir a modo tienda', 'Go to store mode')}</Text>
          </Pressable>
        ) : null}
      </Row>
    </View>
  );
}
