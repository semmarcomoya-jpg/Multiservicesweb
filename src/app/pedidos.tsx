import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { OrderRow, useOrderText } from '@/components/orders';
import { BackBar, Btn, Empty, H1, Loading, Pills, Screen, SearchBox, matches } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

type Tab = 'act' | 'past' | 'rate';

export default function Pedidos() {
  const { L } = useLang();
  const { orders } = useMyOrders(100);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('act');
  const [rated, setRated] = useState<Set<string> | null>(null);
  const { title } = useOrderText();
  useFocusEffect(
    useCallback(() => {
      supabase.from('ratings').select('order_id').limit(1000).then(({ data }) => setRated(new Set(((data as { order_id: string }[]) ?? []).map((r) => r.order_id))));
    }, []),
  );

  const all = orders || [];
  const active = all.filter((o) => o.status === 'verificar' || o.status === 'proceso');
  const past = all.filter((o) => o.status === 'completado' || o.status === 'rechazado');
  // Por calificar: completados de la app en los últimos 30 días sin calificación
  const toRate = all.filter((o) => o.status === 'completado' && o.channel !== 'store' && rated && !rated.has(o.id) && Date.now() - new Date(o.created_at).getTime() < 30 * 86400000);
  const list = tab === 'act' ? active : tab === 'past' ? past : toRate;
  const shown = list.filter((o) => matches(q, o.folio, title(o), o.status, o.cliente_nombre, o.beneficiary?.nombre, o.beneficiary?.apellidos));

  const repeat = (o: Order) => {
    if (o.kind === 'send') return router.push('/enviar');
    if (o.kind === 'service' && o.service_id) return router.push({ pathname: '/servicio/[id]', params: { id: o.service_id } });
    if (o.kind === 'shop') return router.push('/productos');
    return router.push('/credito');
  };

  return (
    <Screen wall="send">
      <BackBar />
      <H1>{L('Mis pedidos', 'My orders')}</H1>
      {!orders ? <Loading /> : null}
      {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
      {orders && orders.length ? (
        <Pills
          options={[
            { v: 'act' as Tab, label: L(`Activos (${active.length})`, `Active (${active.length})`) },
            { v: 'past' as Tab, label: L(`Pasados (${past.length})`, `Past (${past.length})`) },
            { v: 'rate' as Tab, label: L(`Por calificar (${toRate.length})`, `To rate (${toRate.length})`) },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      {list.length > 3 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por folio, servicio o persona', 'Search by ref, service or person')} count={shown.length} /> : null}
      {orders && orders.length && !list.length ? (
        <Empty>{tab === 'act' ? L('No tienes pedidos en curso.', 'No orders in progress.') : tab === 'past' ? L('Aún no hay pedidos terminados.', 'No finished orders yet.') : L('¡Gracias! Ya calificaste todo.', 'Thanks! You have rated everything.')}</Empty>
      ) : null}
      {shown.map((o) => (
        <View key={o.id} style={{ gap: 4 }}>
          <OrderRow o={o} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
          {tab === 'past' && o.status === 'completado' && o.kind !== 'abono' ? (
            <Btn small kind="ghost" icon="repeat" title={L('Repetir', 'Repeat')} style={{ alignSelf: 'flex-end' }} onPress={() => repeat(o)} />
          ) : null}
          {tab === 'rate' ? (
            <Btn small kind="soft" icon="star" title={L('Calificar', 'Rate')} style={{ alignSelf: 'flex-end' }} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
