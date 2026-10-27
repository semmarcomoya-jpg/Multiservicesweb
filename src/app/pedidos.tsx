import { router } from 'expo-router';
import React, { useState } from 'react';

import { OrderRow, useOrderText } from '@/components/orders';
import { BackBar, Empty, H1, Loading, Screen, SearchBox, matches } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';

export default function Pedidos() {
  const { L } = useLang();
  const { orders } = useMyOrders(100);
  const [q, setQ] = useState('');
  const { title } = useOrderText();
  const shown = (orders || []).filter((o) => matches(q, o.folio, title(o), o.status, o.cliente_nombre, o.beneficiary?.nombre, o.beneficiary?.apellidos));
  return (
    <Screen wall="send">
      <BackBar />
      <H1>{L('Mis pedidos', 'My orders')}</H1>
      {!orders ? <Loading /> : null}
      {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
      {orders && orders.length > 3 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por folio, servicio o persona', 'Search by ref, service or person')} count={shown.length} /> : null}
      {shown.map((o) => (
        <OrderRow key={o.id} o={o} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
      ))}
    </Screen>
  );
}
