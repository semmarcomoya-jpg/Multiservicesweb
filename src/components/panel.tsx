import { router, usePathname } from 'expo-router';
import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { useInShell } from '@/components/StaffShell';
import { Icon, LangToggle, Row, ChipScroll } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
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

/** Interruptor grande para abrir o cerrar la tienda (no recibe pedidos nuevos mientras está cerrada). */
export function OpenSwitch({ store, onChanged }: { store: Store; onChanged?: () => void }) {
  const { L } = useLang();
  const [open, setOpen] = useState(store.abierta !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  React.useEffect(() => setOpen(store.abierta !== false), [store.abierta, store.id]);
  const toggle = async () => {
    const next = !open;
    setBusy(true);
    setErr('');
    setOpen(next);
    const { error } = await supabase.from('stores').update({ abierta: next }).eq('id', store.id);
    setBusy(false);
    if (error) {
      setOpen(!next);
      setErr(errMsg(error));
    } else onChanged?.();
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: open, busy }}
      accessibilityLabel={L('Tienda abierta', 'Store open')}
      onPress={toggle}
      disabled={busy}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 40, borderRadius: R.pill, backgroundColor: open ? '#DDF1E4' : C.redSoft }}
    >
      <View style={{ width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: open ? '#2E8B57' : '#93A5BD' }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transform: [{ translateX: open ? 18 : 0 }] }} />
      </View>
      <Text style={{ fontWeight: '900', color: open ? '#1E5B35' : C.red }}>
        {err ? err : open ? L('Abierta · recibe pedidos', 'Open · taking orders') : L('Cerrada · no recibe pedidos', 'Closed · no new orders')}
      </Text>
    </Pressable>
  );
}

/** Selector de vista como en la maqueta: Cliente · Tienda · Admin (según el rol). */
export function ViewSwitch({ current }: { current: 'cliente' | 'tienda' | 'admin' }) {
  const { L } = useLang();
  const { profile } = useAuth();
  if (!profile || profile.role === 'cliente') return null;
  const opts: ['cliente' | 'tienda' | 'admin', string, string, string][] = [
    ['cliente', L('Cliente', 'Customer'), 'user', '/inicio'],
    ['tienda', L('Tienda', 'Store'), 'store', '/tienda'],
    ...(profile.role === 'admin' ? [['admin', L('Admin', 'Admin'), 'lock', '/admin'] as ['admin', string, string, string]] : []),
  ];
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: R.pill, backgroundColor: C.seg }} accessibilityRole="tablist">
      {opts.map(([k, label, ic, href]) => {
        const on = k === current;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => !on && router.replace(href as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: on ? C.ink : 'transparent' }}>
            <Icon n={ic} size={16} color={on ? '#fff' : C.segInk} />
            <Text style={{ fontWeight: '800', color: on ? '#fff' : C.segInk }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PanelHeader({ kind, store, stores, onStoreChange }: { kind: 'tienda' | 'admin'; store?: Store | null; stores?: Store[] | null; onStoreChange?: () => void }) {
  const { L } = useLang();
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const links =
    kind === 'tienda'
      ? [
          ['/tienda', L('Pedidos', 'Orders'), 'receipt'],
          ['/tienda/productos', L('Productos', 'Products'), 'bag'],
          ['/tienda/historias', L('Historias', 'Stories'), 'camera'],
          ['/tienda/corte', L('Ventas y corte', 'Sales & close-out'), 'chart'],
          ['/tienda/ajustes', L('Mi tienda', 'My store'), 'store'],
        ]
      : [
          ['/admin', L('Ventas', 'Sales'), 'chart'],
          ['/admin/apariencia', L('Apariencia', 'Appearance'), 'image'],
          ['/admin/promociones', L('Promociones', 'Promotions'), 'gift'],
          ['/admin/destacados', L('Destacados', 'Featured'), 'star'],
          ['/admin/historias', L('Historias', 'Stories'), 'camera'],
          ['/admin/servicios', L('Servicios', 'Services'), 'tool'],
          ['/admin/tiendas', L('Tiendas', 'Stores'), 'store'],
          ['/admin/cambio', L('Tipo de cambio y reglas', 'Rate & rules'), 'cash'],
          ['/admin/empleados', L('Empleados', 'Staff'), 'users'],
          ['/admin/usuarios', L('Cuentas', 'Accounts'), 'id'],
        ];
  const inShell = useInShell();
  return (
    <View style={{ gap: 10 }}>
      {inShell ? null : (
      <Row style={{ justifyContent: 'space-between' }}>
        <ViewSwitch current={kind} />
        <Row gap={8}>
          <LangToggle />
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await signOut();
              router.replace('/bienvenida');
            }}
            style={{ paddingHorizontal: 14, minHeight: 38, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}
          >
            <Text style={{ color: C.ink, fontWeight: '800' }}>{L('Salir', 'Sign out')}</Text>
          </Pressable>
        </Row>
      </Row>
      )}

      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        {/* Encabezado café como la maqueta */}
        <View style={{ backgroundColor: C.brownDark, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
          <Row gap={8}>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>{kind === 'tienda' ? L('Mostrador', 'Counter') : L('Administración', 'Administration')}</Text>
            <View style={{ backgroundColor: C.gold, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontWeight: '900', color: C.ink, fontSize: 12 }}>{kind === 'tienda' ? (store ? store.nombre.replace('Castillo · ', '') : L('Modo tienda', 'Store mode')) : L('Administrador', 'Administrator')}</Text>
            </View>
          </Row>
          {kind === 'tienda' && profile?.role === 'admin' && stores ? (
            <ChipScroll active={store?.id}>
              {stores.map((st) => (
                <Pressable key={st.id} accessibilityRole="radio" accessibilityState={{ checked: store?.id === st.id }} onPress={() => setAdminStore(st.id)}
                  style={{ paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: R.pill, backgroundColor: store?.id === st.id ? C.gold : 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ fontWeight: '800', color: store?.id === st.id ? C.ink : '#fff' }}>{st.nombre.replace('Castillo · ', '') + (st.abierta === false ? ' · ' + L('cerrada', 'closed') : '')}</Text>
                </Pressable>
              ))}
            </ChipScroll>
          ) : null}
          {kind === 'tienda' && store ? <OpenSwitch store={store} onChanged={onStoreChange} /> : null}
        </View>
        {/* Pestañas en una sola fila que se desliza (cómodo en celular) */}
        <View style={{ backgroundColor: '#DCE7F6', padding: 6 }}>
        <ChipScroll active={path}>
          {links.map(([href, label, ic]) => {
            const on = path === href;
            return (
              <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(href as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 12, backgroundColor: on ? C.ink : 'transparent' }}>
                <Icon n={ic} size={16} color={on ? '#fff' : C.segInk} />
                <Text style={{ fontWeight: '800', color: on ? '#fff' : C.segInk }}>{label}</Text>
              </Pressable>
            );
          })}
        </ChipScroll>
        </View>
      </View>
    </View>
  );
}
