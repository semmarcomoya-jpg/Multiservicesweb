import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';

import { PanelHeader } from '@/components/panel';
import { inPeriod, orderGroup, Summary, useGroups, type Period } from '@/components/summary';
import { Card, H2, IcoBox, Icon, Loading, P, Pills, Row, Screen } from '@/components/ui';
import { useCategories, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { openState } from '@/lib/hours';
import { Scene } from '@/components/scenes';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Order } from '@/lib/types';

export default function AdminVentas() {
  const { L, lang } = useLang();
  const { data: stores } = useStores();
  const { data: cats } = useCategories();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [storeSel, setStoreSel] = useState('all');
  const [period, setPeriod] = useState<Period>('30');
  const [kind, setKind] = useState('all');
  const [svc, setSvc] = useState('all');
  const groups = useGroups(cats || []);
  const [att, setAtt] = useState<{ low: number; ids: number; newc?: number; avg?: number } | null>(null);
  const { width } = useWindowDimensions();
  const narrow = width < 760;

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)
        .then(({ data }) => setOrders((data as Order[]) ?? []));
      Promise.all([
        supabase.from('ratings').select('id', { count: 'exact', head: true }).lte('stars', 2).eq('followed_up', false),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('id_status', 'pendiente'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'cliente').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.rpc('store_scores'),
      ]).then(([r, i, n, sc]) => {
        const rows = ((sc.data as { promedio: number; total: number }[]) ?? []);
        const tt = rows.reduce((x, y) => x + Number(y.total), 0);
        setAtt({ low: r.count || 0, ids: i.count || 0, newc: n.count || 0, avg: tt ? rows.reduce((x, y) => x + Number(y.promedio) * Number(y.total), 0) / tt : 0 });
      });
    }, []),
  );

  if (!stores || !cats || !orders) {
    return (
      <Screen wide>
        <Loading />
      </Screen>
    );
  }

  const base = orders.filter((o) => storeSel === 'all' || o.store_id === storeSel);
  const per = orders.filter((o) => inPeriod(o, period) && o.status !== 'rechazado');
  const rows = groups
    .map(([k, label, icon]) => ({ k, label, icon, cells: stores.map((st) => per.filter((o) => o.store_id === st.id && orderGroup(o) === k).reduce((a, o) => a + Number(o.total), 0)) }))
    .filter((r) => r.cells.some((c) => c > 0));
  const colTot = stores.map((_, i) => rows.reduce((a, r) => a + r.cells[i], 0));
  const cell = { width: 150, paddingVertical: 10, paddingHorizontal: 8 } as const;

  // Lo que necesita a alguien hoy
  const H = 3600000;
  const verif = orders.filter((o) => o.status === 'verificar');
  const verifOld = verif.filter((o) => Date.now() - new Date(o.created_at).getTime() > 2 * H);
  const stuck = orders.filter((o) => o.status === 'proceso' && Date.now() - new Date(o.created_at).getTime() > 24 * H);
  const closed = stores.filter((s) => s.activo && s.abierta === false);
  const items = [
    verif.length && { n: verif.length, ic: 'cash', t: L('pagos por verificar', 'payments to verify') + (verifOld.length ? L(` (${verifOld.length} con más de 2 horas)`, ` (${verifOld.length} over 2 hours)`) : ''), go: '/tienda', red: verifOld.length > 0 },
    stuck.length && { n: stuck.length, ic: 'clock', t: L('pedidos en proceso desde hace más de un día', 'orders in progress for over a day'), go: '/tienda', red: true },
    att?.low && { n: att.low, ic: 'star', t: L('calificaciones bajas sin seguimiento', 'low ratings without follow-up'), go: '/admin/calificaciones', red: true },
    att?.ids && { n: att.ids, ic: 'id', t: L('identificaciones por revisar', 'IDs to review'), go: '/tienda/identificaciones', red: false },
    closed.length && { n: closed.length, ic: 'store', t: L('sucursales marcadas como cerradas: ', 'branches marked closed: ') + closed.map((s) => s.nombre.replace('Castillo · ', '')).join(', '), go: '/admin/tiendas', red: false },
  ].filter(Boolean) as { n: number; ic: string; t: string; go: string; red: boolean }[];

  return (
    <Screen wide>
      <Card style={{ borderWidth: 2, borderColor: items.some((x) => x.red) ? C.red : C.line }}>
        <H2>{L('Requiere tu atención', 'Needs your attention')}</H2>
        {items.length ? items.map((x) => (
          <Pressable key={x.go + x.ic} accessibilityRole="link" onPress={() => router.push(x.go as never)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}>
            <IcoBox n={x.ic} size={32} bg={x.red ? C.redSoft : C.icoBg} color={x.red ? C.red : C.brown} />
            <Text style={{ flex: 1, color: C.ink, fontWeight: '700' }}><Text style={{ fontWeight: '900', fontSize: 17 }}>{x.n} </Text>{x.t}</Text>
            <Icon n="arrow" size={16} color={C.muted} />
          </Pressable>
        )) : <P muted>{L('Todo al día. No hay pendientes.', 'All caught up. Nothing pending.')}</P>}
      </Card>
      {(() => {
        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
        const todayO = orders.filter((o) => o.paid_at && o.status !== 'rechazado' && new Date(o.paid_at).getTime() >= t0.getTime());
        const tot = todayO.reduce((x, o) => x + Number(o.total), 0);
        const sends = todayO.filter((o) => o.kind === 'send').length;
        const kp = [
          [L('Vendido hoy', 'Sold today'), money(tot)],
          [L('Envíos de dinero hoy', 'Transfers today'), String(sends)],
          [L('Clientes nuevos hoy', 'New customers today'), String(att?.newc ?? '—')],
          [L('Promedio de reseñas', 'Average rating'), att?.avg ? `${att.avg.toFixed(1)} ★` : '—'],
        ];
        return (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {kp.map(([t, v]) => (
                <View key={t} style={{ flexGrow: 1, flexBasis: 150, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.muted }}>{t}</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stores.filter((x) => x.activo).map((x) => {
                const v = todayO.filter((o) => o.store_id === x.id).reduce((y, o) => y + Number(o.total), 0);
                const p = tot ? Math.round((v / tot) * 100) : 0;
                const os = openState(x);
                return (
                  <Pressable key={x.id} accessibilityRole="button" onPress={() => setStoreSel(x.id)}
                    style={{ flexGrow: 1, flexBasis: 220, backgroundColor: C.card, borderWidth: storeSel === x.id ? 2 : 1, borderColor: storeSel === x.id ? C.brown : C.line, borderRadius: 16, padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n="envio" size={40} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: C.ink }}>{x.nombre.replace('Castillo · ', '')}</Text>
                        <Text style={{ fontSize: 12, color: os.open ? '#1E7A4A' : C.muted }}>{os.label[lang]}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(v)}</Text>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: C.tint, overflow: 'hidden' }}><View style={{ width: `${p}%`, height: '100%', backgroundColor: C.brown }} /></View>
                    <Text style={{ fontSize: 12, color: C.muted }}>{L(`${p} % de lo vendido hoy`, `${p}% of today's sales`)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        );
      })()}
      <Pills options={[{ v: 'all', label: L('Todas las tiendas', 'All stores') }, ...stores.map((s) => ({ v: s.id, label: s.nombre.replace('Castillo · ', ''), icon: 'store' }))]} value={storeSel} onChange={setStoreSel} />
      <Summary orders={base} cats={cats} period={period} setPeriod={setPeriod} kind={kind} setKind={setKind} svc={svc} setSvc={setSvc} />
      <Card>
        <H2>{L('Por tienda y tipo', 'By store and type')}</H2>
        {narrow ? (
          // En celular: una tarjeta por tipo, con cada tienda en su renglón (nada se corta)
          <View style={{ gap: 10 }}>
            {[...rows, { k: '__tot', label: L('Total de todas', 'All types'), icon: 'chart', cells: colTot }].map((r) => (
              <View key={r.k} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, gap: 6, backgroundColor: r.k === '__tot' ? C.tint : C.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IcoBox n={r.icon} size={28} />
                  <Text style={{ flex: 1, fontWeight: '900', color: C.ink }}>{r.label}</Text>
                  <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>{money(r.cells.reduce((a, c) => a + c, 0))}</Text>
                </View>
                {stores.map((s, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingLeft: 36 }}>
                    <Text style={{ flex: 1, color: C.muted, fontWeight: '700' }}>{s.nombre.replace('Castillo · ', '')}</Text>
                    <Text style={{ color: C.ink, fontWeight: '700' }}>{r.cells[i] ? money(r.cells[i]) : '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
        <ScrollView horizontal>
          <View>
            <Row gap={0} style={{ borderBottomWidth: 1, borderBottomColor: C.line, flexWrap: 'nowrap' }}>
              <Text style={[cell, { width: 220, fontWeight: '800', color: C.muted }]}>{L('Tipo', 'Type')}</Text>
              {stores.map((s) => <Text key={s.id} style={[cell, { textAlign: 'right', fontWeight: '800', color: C.muted }]}>{s.nombre.replace('Castillo · ', '')}</Text>)}
              <Text style={[cell, { textAlign: 'right', fontWeight: '800', color: C.muted }]}>{L('Total', 'Total')}</Text>
            </Row>
            {rows.map((r) => (
              <Row key={r.k} gap={0} style={{ borderBottomWidth: 1, borderBottomColor: C.line, flexWrap: 'nowrap' }}>
                <View style={[cell, { width: 220, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                  <IcoBox n={r.icon} size={28} />
                  <Text style={{ fontWeight: '700', color: C.ink, flex: 1 }}>{r.label}</Text>
                </View>
                {r.cells.map((c, i) => <Text key={i} style={[cell, { textAlign: 'right', color: C.ink }]}>{c ? money(c) : '—'}</Text>)}
                <Text style={[cell, { textAlign: 'right', fontWeight: '900', color: C.ink }]}>{money(r.cells.reduce((a, c) => a + c, 0))}</Text>
              </Row>
            ))}
            <Row gap={0} style={{ backgroundColor: C.tint, flexWrap: 'nowrap' }}>
              <Text style={[cell, { width: 220, fontWeight: '900', color: C.ink }]}>{L('Total', 'Total')}</Text>
              {colTot.map((c, i) => <Text key={i} style={[cell, { textAlign: 'right', fontWeight: '900', color: C.ink }]}>{money(c)}</Text>)}
              <Text style={[cell, { textAlign: 'right', fontWeight: '900', color: C.ink }]}>{money(colTot.reduce((a, c) => a + c, 0))}</Text>
            </Row>
          </View>
        </ScrollView>
        )}
      </Card>
    </Screen>
  );
}
