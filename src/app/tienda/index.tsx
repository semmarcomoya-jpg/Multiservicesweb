import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { OrderRow } from '@/components/orders';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { orderGroup, orderSvcKey, inPeriod, Summary, type Period } from '@/components/summary';
import { Empty, Loading, Pills, Screen } from '@/components/ui';
import { useCategories, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

export default function TiendaPedidos() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const { data: cats } = useCategories();
  const st = usePanelStore(stores);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState('todos');
  const [period, setPeriod] = useState<Period>('30');
  const [kind, setKind] = useState('all');
  const [svc, setSvc] = useState('all');

  const load = useCallback(async () => {
    if (!st) return;
    const { data } = await supabase.from('orders').select('*').eq('store_id', st.id).order('created_at', { ascending: false }).limit(500);
    setOrders((data as Order[]) ?? []);
  }, [st]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Pedidos nuevos o cambios aparecen al instante
  useEffect(() => {
    if (!st) return;
    const ch = supabase
      .channel('store-orders-' + st.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${st.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [st, load]);

  if (!stores || !cats) return <Loading />;
  const base = (orders || []).filter((o) => inPeriod(o, period) && (kind === 'all' || orderGroup(o) === kind) && (svc === 'all' || orderSvcKey(o) === svc));
  const count = (k: string) => base.filter((o) => k === 'todos' || o.status === k).length;
  const list = base.filter((o) => status === 'todos' || o.status === status);

  return (
    <Screen wide>
      <PanelHeader kind="tienda" store={st} stores={stores} onStoreChange={reload} />
      {!orders ? (
        <Loading />
      ) : (
        <>
          <Summary orders={orders} cats={cats} period={period} setPeriod={setPeriod} kind={kind} setKind={setKind} svc={svc} setSvc={setSvc} />
          <Pills
            options={[
              { v: 'todos', label: `${L('Todos', 'All')} · ${count('todos')}` },
              { v: 'verificar', label: `${L('Por verificar', 'To verify')} · ${count('verificar')}` },
              { v: 'proceso', label: `${L('En proceso', 'In progress')} · ${count('proceso')}` },
              { v: 'completado', label: `${L('Completados', 'Done')} · ${count('completado')}` },
              { v: 'rechazado', label: `${L('Rechazados', 'Rejected')} · ${count('rechazado')}` },
            ]}
            value={status}
            onChange={setStatus}
          />
          {list.length === 0 ? <Empty>{L('No hay pedidos con estos filtros.', 'No orders with these filters.')}</Empty> : null}
          {list.map((o) => (
            <OrderRow key={o.id} o={o} showClient onPress={() => router.push({ pathname: '/tienda/pedido/[id]', params: { id: o.id } })} />
          ))}
        </>
      )}
    </Screen>
  );
}
