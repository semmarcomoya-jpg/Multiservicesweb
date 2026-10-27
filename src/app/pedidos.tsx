import { router } from 'expo-router';
import React from 'react';

import { OrderRow } from '@/components/orders';
import { BackBar, Empty, H1, Loading, Screen } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';

export default function Pedidos() {
  const { L } = useLang();
  const { orders } = useMyOrders(100);
  return (
    <Screen wall="send">
      <BackBar />
      <H1>{L('Mis pedidos', 'My orders')}</H1>
      {!orders ? <Loading /> : null}
      {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
      {(orders || []).map((o) => (
        <OrderRow key={o.id} o={o} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
      ))}
    </Screen>
  );
}
