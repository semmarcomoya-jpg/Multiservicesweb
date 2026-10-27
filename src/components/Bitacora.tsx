/** Bitácora (trazabilidad): quién cambió qué, cuándo y en qué sucursal. */
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Card, Empty, H2, IcoBox, Loading, Note, P, Pills, SearchBox, matches } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Store } from '@/lib/types';

interface Row {
  id: number;
  at: string;
  user_name: string;
  user_role: string;
  tabla: string;
  accion: 'crear' | 'cambiar' | 'borrar';
  titulo: string;
  store_id: string | null;
  cambios: Record<string, unknown>;
}

const TABLAS: Record<string, [string, string, string]> = {
  stores: ['Sucursales', 'Branches', 'store'],
  services: ['Servicios', 'Services', 'tool'],
  service_categories: ['Categorías', 'Categories', 'tool'],
  settings: ['Tipo de cambio y ajustes', 'Rate & settings', 'cash'],
  products: ['Productos', 'Products', 'bag'],
  product_variants: ['Precios y existencias', 'Prices & stock', 'bag'],
  promos: ['Promociones', 'Promotions', 'gift'],
  featured: ['Destacados', 'Featured', 'star'],
  stories: ['Historias', 'Stories', 'camera'],
  employees: ['Empleados', 'Staff', 'users'],
  profiles: ['Cuentas y roles', 'Accounts & roles', 'id'],
  cortes: ['Cortes de caja', 'Close-outs', 'chart'],
};

const short = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  }
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
};

export function Bitacora({ stores, storeId }: { stores: Store[]; storeId?: string | null }) {
  const { L, lang } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [tabla, setTabla] = useState('all');
  const [st, setSt] = useState<string>(storeId || 'all');

  useFocusEffect(
    useCallback(() => {
      let qy = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(800);
      if (storeId) qy = qy.eq('store_id', storeId);
      qy.then(({ data, error }) => {
        if (error) setErr(error.message.includes('audit_log') ? L('Falta correr el SQL de la bitácora en Supabase.', 'Run the audit log SQL in Supabase first.') : error.message);
        setRows((data as Row[]) ?? []);
      });
    }, [storeId]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const storeName = (id: string | null) => (id ? (stores.find((s) => s.id === id)?.nombre || '').replace('Castillo · ', '') : '');
  const verb = (a: Row['accion']) => ({ crear: L('creó', 'created'), cambiar: L('cambió', 'changed'), borrar: L('borró', 'deleted') })[a];
  const roleTxt = (r: string) => ({ admin: L('Administrador', 'Admin'), tienda: L('Tienda', 'Store'), cliente: L('Cliente', 'Customer'), sistema: L('Sistema', 'System') })[r] || r;

  const list = (rows || []).filter(
    (r) =>
      (tabla === 'all' || r.tabla === tabla) &&
      (st === 'all' || r.store_id === st) &&
      matches(q, r.user_name, r.titulo, TABLAS[r.tabla]?.[0], TABLAS[r.tabla]?.[1], storeName(r.store_id), Object.keys(r.cambios || {}).join(' ')),
  );
  const used = [...new Set((rows || []).map((r) => r.tabla))];

  return (
    <Card>
      <H2>{L('Bitácora', 'Activity log')}</H2>
      <P small muted>
        {L(
          'Trazabilidad: cada cambio en sucursales, servicios, productos, precios, promociones, historias, empleados y cuentas queda aquí con quién lo hizo y cuándo. Nadie la puede editar. Lo de cada pedido (quién confirmó el pago, quién lo entregó) está en el historial del pedido.',
          'Traceability: every change to branches, services, products, prices, promotions, stories, staff and accounts is recorded here with who did it and when. Nobody can edit it. Each order keeps its own history (who confirmed payment, who handed it over).',
        )}
      </P>
      {err ? <Note kind="red">{err}</Note> : null}
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca persona, producto, sucursal…', 'Search person, product, branch…')} count={q ? list.length : undefined} />
      <Pills options={[{ v: 'all', label: L('Todo', 'All') }, ...used.map((t) => ({ v: t, label: L(TABLAS[t]?.[0] || t, TABLAS[t]?.[1] || t), icon: TABLAS[t]?.[2] }))]} value={tabla} onChange={setTabla} />
      {!storeId && stores.length > 1 ? (
        <Pills options={[{ v: 'all', label: L('Todas las sucursales', 'All branches') }, ...stores.map((s) => ({ v: s.id, label: storeName(s.id), icon: 'store' }))]} value={st} onChange={setSt} />
      ) : null}
      {!rows ? <Loading /> : null}
      {rows && list.length === 0 ? <Empty>{L('Sin movimientos con estos filtros.', 'No activity with these filters.')}</Empty> : null}
      {list.slice(0, 300).map((r) => {
        const t = TABLAS[r.tabla];
        const ch = Object.entries(r.cambios || {});
        return (
          <View key={r.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <IcoBox n={t?.[2] || 'doc'} size={34} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ color: C.ink }}>
                <Text style={{ fontWeight: '900' }}>{r.user_name || L('Alguien', 'Someone')}</Text>
                <Text style={{ color: C.muted }}> ({roleTxt(r.user_role)}) </Text>
                {verb(r.accion)} <Text style={{ fontWeight: '800' }}>{L(t?.[0] || r.tabla, t?.[1] || r.tabla).toLowerCase()}</Text>
                {r.titulo ? <Text>: {r.titulo}</Text> : null}
              </Text>
              {r.accion === 'cambiar' && ch.length ? (
                <P small muted>
                  {ch
                    .slice(0, 4)
                    .map(([k, v]) => (Array.isArray(v) ? `${k}: ${short(v[0])} → ${short(v[1])}` : k))
                    .join(' · ')}
                  {ch.length > 4 ? ` · +${ch.length - 4}` : ''}
                </P>
              ) : null}
              <P small muted>
                {new Date(r.at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                {r.store_id ? ' · ' + storeName(r.store_id) : ''}
              </P>
            </View>
          </View>
        );
      })}
    </Card>
  );
}
