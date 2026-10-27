import { router, usePathname } from 'expo-router';
import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';

import { NotifBell } from '@/components/NotifBell';
import { useInShell } from '@/components/StaffShell';
import { Icon, LangToggle, Row, ChipScroll } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useStores } from '@/lib/data';
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
export function OpenSwitch({ store, onChanged, compact }: { store: Store; onChanged?: () => void; compact?: boolean }) {
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 6 : 10, paddingHorizontal: compact ? 6 : 12, minHeight: compact ? 32 : 40, borderRadius: R.pill, backgroundColor: open ? '#DDF1E4' : C.redSoft }}
    >
      <View style={{ width: compact ? 32 : 42, height: compact ? 18 : 24, borderRadius: 12, padding: compact ? 2 : 3, backgroundColor: open ? '#2E8B57' : '#93A5BD' }}>
        <View style={{ width: compact ? 14 : 18, height: compact ? 14 : 18, borderRadius: 9, backgroundColor: '#fff', transform: [{ translateX: open ? (compact ? 14 : 18) : 0 }] }} />
      </View>
      <Text style={{ fontWeight: '900', fontSize: compact ? 13 : 14, color: open ? '#1E5B35' : C.red }}>
        {err ? err : compact ? (open ? L('Abierta', 'Open') : L('Cerrada', 'Closed')) : open ? L('Abierta · recibe pedidos', 'Open · taking orders') : L('Cerrada · no recibe pedidos', 'Closed · no new orders')}
      </Text>
    </Pressable>
  );
}

/** Selector de vista como en la maqueta: Cliente · Tienda · Admin (según el rol). */
export function ViewSwitch({ current, compact }: { current: 'cliente' | 'tienda' | 'admin'; compact?: boolean }) {
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: compact ? 34 : 38, paddingHorizontal: compact ? 11 : 16, borderRadius: R.pill, backgroundColor: on ? C.ink : 'transparent' }}>
            {compact ? null : <Icon n={ic} size={16} color={on ? '#fff' : C.segInk} />}
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
          ['/tienda/mostrador', L('Mostrador', 'Counter'), 'qr'],
          ['/tienda/creditos', L('Créditos', 'Credits'), 'wallet'],
          ['/tienda/productos', L('Productos', 'Products'), 'bag'],
          ['/tienda/comunidad', L('Boca a boca', 'Word of mouth'), 'chat'],
          ['/tienda/calificaciones', L('Calificaciones', 'Ratings'), 'star'],
          ['/tienda/historias', L('Historias', 'Stories'), 'camera'],
          ['/tienda/corte', L('Ventas y corte', 'Sales & close-out'), 'chart'],
          ['/tienda/ajustes', L('Mi tienda', 'My store'), 'store'],
          ['/tienda/identificaciones', L('Identificaciones', 'IDs'), 'id'],
          ['/tienda/clientes', L('Clientes', 'Customers'), 'users'],
          ['/tienda/bitacora', L('Bitácora', 'Activity log'), 'clock'],
        ]
      : [
          ['/admin', L('Ventas', 'Sales'), 'chart'],
          ['/admin/apariencia', L('Apariencia', 'Appearance'), 'image'],
          ['/admin/promociones', L('Promociones', 'Promotions'), 'gift'],
          ['/admin/destacados', L('Destacados', 'Featured'), 'star'],
          ['/admin/historias', L('Historias', 'Stories'), 'camera'],
          ['/admin/servicios', L('Servicios', 'Services'), 'tool'],
          ['/admin/productos', L('Productos', 'Products'), 'bag'],
          ['/admin/tiendas', L('Tiendas', 'Stores'), 'store'],
          ['/admin/cambio', L('Tipo de cambio', 'Exchange rate'), 'cash'],
          ['/admin/reglas', L('Reglas', 'Rules'), 'shield'],
          ['/admin/textos', L('Textos y ayuda', 'Texts & help'), 'doc'],
          ['/admin/calificaciones', L('Calificaciones', 'Ratings'), 'star'],
          ['/admin/comunidad', L('Boca a boca', 'Word of mouth'), 'chat'],
          ['/admin/empleados', L('Empleados', 'Staff'), 'users'],
          ['/admin/usuarios', L('Cuentas', 'Accounts'), 'id'],
          ['/admin/bitacora', L('Bitácora', 'Activity log'), 'clock'],
        ];
  const inShell = useInShell();
  // En celular el menú queda fijo arriba, así que lo hacemos más bajito
  const compact = useWindowDimensions().width < 700;
  return (
    <View style={{ gap: compact ? 6 : 10 }}>
      {inShell ? null : (
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }} gap={6}>
        <ViewSwitch current={kind} compact={compact} />
        <Row gap={6} style={{ flexWrap: 'nowrap' }}>
          <NotifBell />
          {compact ? null : <LangToggle />}
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await signOut();
              router.replace('/bienvenida');
            }}
            style={{ paddingHorizontal: compact ? 11 : 14, minHeight: compact ? 34 : 38, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}
          >
            <Text style={{ color: C.ink, fontWeight: '800' }}>{L('Salir', 'Sign out')}</Text>
          </Pressable>
        </Row>
      </Row>
      )}

      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        {/* Encabezado café como la maqueta */}
        <View style={{ backgroundColor: C.brownDark, paddingHorizontal: compact ? 12 : 16, paddingVertical: compact ? 8 : 14, gap: compact ? 6 : 10 }}>
          <Row gap={8} style={compact ? { flexWrap: 'nowrap' } : undefined}>
            {compact && kind === 'tienda' ? null : (
              <Text style={{ color: '#fff', fontSize: compact ? 16 : 19, fontWeight: '900' }}>{kind === 'tienda' ? L('Mostrador', 'Counter') : L('Administración', 'Administration')}</Text>
            )}
            <View style={{ backgroundColor: C.gold, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: '900', color: C.ink, fontSize: 12 }} numberOfLines={1}>{kind === 'tienda' ? (store ? store.nombre.replace('Castillo · ', '') : L('Modo tienda', 'Store mode')) : L('Administrador', 'Administrator')}</Text>
            </View>
            {compact && kind === 'tienda' && store ? (
              <View style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <OpenSwitch store={store} onChanged={onStoreChange} compact />
              </View>
            ) : null}
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
          {kind === 'tienda' && store && !compact ? <OpenSwitch store={store} onChanged={onStoreChange} /> : null}
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

/**
 * Encabezado y pestañas del panel, puestos UNA vez en el layout: al cambiar de pestaña
 * solo cambia el contenido de abajo (el menú no se vuelve a dibujar ni regresa al inicio).
 */
export function PanelFrame({ kind, children }: { kind: 'tienda' | 'admin'; children: React.ReactNode }) {
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, zIndex: 2, backgroundColor: C.page }}>
        {kind === 'tienda' ? <PanelHeader kind="tienda" store={st} stores={stores} onStoreChange={reload} /> : <PanelHeader kind="admin" />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
