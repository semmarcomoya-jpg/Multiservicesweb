import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';

import { PanelHeader } from '@/components/panel';
import { inPeriod, orderGroup, Summary, useGroups, type Period } from '@/components/summary';
import { Card, H2, IcoBox, Loading, Pills, Row, Screen } from '@/components/ui';
import { useCategories, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Order } from '@/lib/types';

export default function AdminVentas() {
  const { L } = useLang();
  const { data: stores } = useStores();
  const { data: cats } = useCategories();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [storeSel, setStoreSel] = useState('all');
  const [period, setPeriod] = useState<Period>('30');
  const [kind, setKind] = useState('all');
  const [svc, setSvc] = useState('all');
  const groups = useGroups(cats || []);
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
    }, []),
  );

  if (!stores || !cats || !orders) {
    return (
      <Screen wide>
        <PanelHeader kind="admin" />
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

  return (
    <Screen wide>
      <PanelHeader kind="admin" />
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
