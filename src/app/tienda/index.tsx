import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { OrderRow } from '@/components/orders';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { orderGroup, orderSvcKey, inPeriod, Summary, type Period } from '@/components/summary';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { useOrderText } from '@/components/orders';
import { Btn, Empty, Loading, Pills, Screen, SearchBox, matches, Icon, P } from '@/components/ui';
import { money } from '@/lib/format';
import { playAlert } from '@/lib/alert';
import { C, R } from '@/lib/theme';
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
  const [q, setQ] = useState('');
  const [view, setView] = useState<'tablero' | 'lista'>('tablero');
  const [alert, setAlert] = useState<Order | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const { title, modeLabel } = useOrderText();

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${st.id}` }, (ev) => {
        // Pedido nuevo de la app: aviso grande con sonido (en mostrador no hace falta)
        const n = ev.new as Order | undefined;
        if (ev.eventType === 'INSERT' && n && n.channel !== 'store') {
          setAlert(n);
          setFresh((f) => [...f, n.id]);
          playAlert();
        }
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [st, load]);

  if (!stores || !cats) return <Loading />;
  const base = (orders || []).filter((o) => inPeriod(o, period) && (kind === 'all' || orderGroup(o) === kind) && (svc === 'all' || orderSvcKey(o) === svc) && matches(q, o.folio, o.cliente_nombre, o.cliente_code, o.zelle_nombre, o.attended_name, o.service_name?.es, o.beneficiary?.nombre, o.beneficiary?.apellidos, (o.items || []).map((x) => x.name).join(' ')));
  const count = (k: string) => base.filter((o) => k === 'todos' || o.status === k).length;
  const list = base.filter((o) => status === 'todos' || o.status === status);

  const today = new Date().toDateString();
  const all = orders || [];
  const kp = [
    ['verificar', L('Pagos por verificar', 'Payments to verify'), String(all.filter((o) => o.status === 'verificar').length)],
    ['proceso', L('En proceso', 'In progress'), String(all.filter((o) => o.status === 'proceso').length)],
    ['completado', L('Completados hoy', 'Done today'), String(all.filter((o) => o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today).length)],
    ['vendido', L('Vendido hoy', 'Sold today'), money(all.filter((o) => o.paid_at && o.status !== 'rechazado' && new Date(o.paid_at).toDateString() === today).reduce((a2, o) => a2 + Number(o.total), 0))],
  ] as const;
  const open = (o: Order) => {
    setFresh((f) => f.filter((x) => x !== o.id));
    router.push({ pathname: '/tienda/pedido/[id]', params: { id: o.id } });
  };
  const card = (o: Order) => (
    <Pressable key={o.id} accessibilityRole="button" onPress={() => open(o)}
      style={({ pressed }) => ({ backgroundColor: fresh.includes(o.id) ? '#FFF2D6' : C.card, borderRadius: 12, borderWidth: 1, borderColor: fresh.includes(o.id) ? '#E8A317' : C.line, padding: 10, gap: 2, opacity: pressed ? 0.85 : 1 })}>
      <Text style={{ fontWeight: '900', color: C.ink }} numberOfLines={1}>{o.folio} · {o.cliente_nombre}</Text>
      <P small muted>{title(o)}</P>
      <P small><Text style={{ fontWeight: '900', color: C.ink }}>{money(o.total)}</Text>{o.entrega?.mode ? ' · ' + modeLabel(o.entrega.mode) : ''}{o.channel === 'store' ? ' · ' + L('mostrador', 'counter') : ''}</P>
    </Pressable>
  );
  const col = (k: string, label: string, rows: Order[]) => (
    <View key={k} style={{ flexGrow: 1, flexBasis: 260, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '900', color: C.segInk }}>{label}</Text>
        <Text style={{ fontWeight: '900', color: C.segInk }}>{rows.length}</Text>
      </View>
      {rows.length ? rows.slice(0, 30).map(card) : <P small muted>{L('Nada por aquí', 'Nothing here')}</P>}
    </View>
  );

  return (
    <Screen wide>
      {!orders ? (
        <Loading />
      ) : (
        <>
          {alert ? (
            <View style={{ backgroundColor: '#FFF2D6', borderWidth: 2, borderColor: '#E8A317', borderRadius: R.lg, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon n="bell" size={26} color="#7A4A00" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '900', fontSize: 18, color: C.ink }}>{L('Pedido nuevo · ', 'New order · ') + alert.folio}</Text>
                  <P small>{alert.cliente_nombre} · {title(alert)} · {money(alert.total)}</P>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn small title={L('Ver pedido', 'View order')} onPress={() => { const o = alert; setAlert(null); open(o); }} />
                <Btn small kind="ghost" title={L('Cerrar', 'Close')} onPress={() => setAlert(null)} />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kp.map(([k, label, v]) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => { if (k !== 'vendido') { setStatus(k); setView('lista'); } }}
                style={{ flexGrow: 1, flexBasis: 150, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                <P small muted style={{ fontWeight: '800' }}>{label}</P>
                <Text style={{ fontSize: 22, fontWeight: '900', color: k === 'verificar' && v !== '0' ? '#7A4A00' : C.ink }}>{v}</Text>
              </Pressable>
            ))}
          </View>
          <Pills options={[{ v: 'tablero' as const, label: L('Tablero', 'Board') }, { v: 'lista' as const, label: L('Lista y resumen', 'List & summary') }]} value={view} onChange={setView} />
          {view === 'tablero' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              {col('verificar', L('Verificar pago', 'Verify payment'), all.filter((o) => o.status === 'verificar'))}
              {col('proceso', L('En proceso', 'In progress'), all.filter((o) => o.status === 'proceso'))}
              {col('completado', L('Completados hoy', 'Done today'), all.filter((o) => o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today))}
            </View>
          ) : (
          <>
          <Summary orders={orders} cats={cats} period={period} setPeriod={setPeriod} kind={kind} setKind={setKind} svc={svc} setSvc={setSvc} />
          <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca folio, cliente, número CM o servicio', 'Search ref, customer, CM number or service')} count={q ? list.length : undefined} />
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
        </>
      )}
    </Screen>
  );
}
