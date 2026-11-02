import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { OrderRow } from '@/components/orders';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { orderGroup, orderSvcKey, inPeriod, Summary, type Period } from '@/components/summary';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { useOrderText } from '@/components/orders';
import { Btn, Empty, Loading, Pills, Screen, SearchBox, matches, Icon, P } from '@/components/ui';
import { Scene } from '@/components/scenes';
import { money } from '@/lib/format';
import { playAlert } from '@/lib/alert';
import { C, R } from '@/lib/theme';
import { useCategories, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { IdDocRow, Order, Plan } from '@/lib/types';
import { Seg } from '@/components/ui';

export default function TiendaPedidos() {
  const { L, lang } = useLang();
  const { data: stores, reload } = useStores();
  const { data: cats } = useCategories();
  const st = usePanelStore(stores);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState('todos');
  const [period, setPeriod] = useState<Period>('30');
  const [kind, setKind] = useState('all');
  const [svc, setSvc] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'tablero' | 'sol' | 'auto' | 'lista'>('tablero');
  const [selId, setSelId] = useState<string | null>(null);
  const [plansReq, setPlansReq] = useState<Plan[]>([]);
  const [idsReq, setIdsReq] = useState<IdDocRow[]>([]);
  const [nStories, setNStories] = useState(0);
  const [boardW, setBoardW] = useState(0);
  const [alert, setAlert] = useState<Order | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const { title, modeLabel } = useOrderText();

  const load = useCallback(async () => {
    if (!st) return;
    const { data } = await supabase.from('orders').select('*').eq('store_id', st.id).order('created_at', { ascending: false }).limit(500);
    setOrders((data as Order[]) ?? []);
    supabase.from('plans').select('*').eq('store_id', st.id).eq('status', 'solicitado').order('created_at', { ascending: false }).limit(50).then(({ data: p }) => setPlansReq((p as Plan[]) ?? []));
    supabase.rpc('pending_ids', { p_all: false }).then(({ data: d }) => setIdsReq((d as IdDocRow[]) ?? []));
    supabase.from('stories').select('id', { count: 'exact', head: true }).or(`store_id.eq.${st.id},store_id.is.null`).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).then(({ count }) => setNStories(count || 0));
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
  const boardRows = all.filter((o) => o.status === 'verificar' || o.status === 'proceso' || (o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today));
  const sel = boardRows.find((o) => o.id === selId) || boardRows[0];
  const wideBoard = boardW >= 960;
  const nameLike = (a?: string | null, b?: string | null) => {
    const n = (x?: string | null) => (x || '').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
    const A = n(a), B = n(b);
    return A.length > 0 && B.length > 0 && A.some((w) => B.includes(w));
  };
  const steps = (o: Order) => [
    [L('Pago con Zelle', 'Zelle payment'), o.status !== 'verificar'],
    [L('En proceso', 'In progress'), o.status === 'completado'],
    [L('Entregado · se avisó al cliente', 'Delivered · customer notified'), o.status === 'completado'],
  ] as [string, boolean][];
  const detail = sel ? (
    <View style={{ flexBasis: wideBoard ? 290 : '100%', flexGrow: wideBoard ? 0 : 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: C.ink }}>{sel.folio}</Text>
          <P small muted>{sel.cliente_nombre} · {title(sel)}</P>
        </View>
        <Text style={{ fontWeight: '900', color: C.ink }}>{money(sel.total)}</Text>
      </View>
      {steps(sel).map(([l, d], i) => {
        const curI = steps(sel).findIndex((x) => !x[1]);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: d ? '#1E7A4A' : i === curI ? C.brown : C.line, backgroundColor: d ? '#1E7A4A' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {d ? <Icon n="check" size={10} color="#fff" sw={3.4} /> : null}
            </View>
            <Text style={{ fontSize: 13, color: C.ink, fontWeight: i === curI ? '800' : '600' }}>{l}</Text>
          </View>
        );
      })}
      {sel.entrega?.mode ? <P small muted>{modeLabel(sel.entrega.mode)}{sel.entrega.time ? ' · ' + sel.entrega.time : ''}</P> : null}
      {sel.status === 'verificar' && sel.zelle_nombre ? (
        <View style={{ backgroundColor: nameLike(sel.zelle_nombre, sel.cliente_nombre) ? '#DDF1E4' : '#FFF2D6', borderRadius: 12, padding: 10 }}>
          <Text style={{ fontWeight: '800', fontSize: 12.5, color: nameLike(sel.zelle_nombre, sel.cliente_nombre) ? '#1E7A4A' : '#7A4A00' }}>
            {nameLike(sel.zelle_nombre, sel.cliente_nombre) ? L(`Nombre en Zelle "${sel.zelle_nombre}" se parece a ${sel.cliente_nombre}`, `Zelle name "${sel.zelle_nombre}" matches ${sel.cliente_nombre}`) : L(`Ojo: en Zelle dice "${sel.zelle_nombre}"`, `Check: Zelle says "${sel.zelle_nombre}"`)}
          </Text>
        </View>
      ) : null}
      <Btn icon={sel.status === 'verificar' ? 'check' : 'arrow'} title={sel.status === 'verificar' ? L('Revisar el pago', 'Review payment') : sel.status === 'proceso' ? L('Atender · entregar con código', 'Handle · deliver with code') : L('Ver el pedido', 'View order')} onPress={() => open(sel)} />
    </View>
  ) : null;
  const card = (o: Order) => (
    <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: sel?.id === o.id }} onPress={() => { setFresh((f) => f.filter((x) => x !== o.id)); setSelId(o.id); }}
      style={({ pressed }) => ({ backgroundColor: fresh.includes(o.id) ? '#FFF2D6' : C.card, borderRadius: 12, borderWidth: sel?.id === o.id ? 2 : 1, borderColor: sel?.id === o.id ? C.brown : fresh.includes(o.id) ? '#E8A317' : C.line, padding: sel?.id === o.id ? 9 : 10, gap: 2, opacity: pressed ? 0.85 : 1 })}>
      <Text style={{ fontWeight: '900', color: C.ink }} numberOfLines={1}>{o.folio} · {o.cliente_nombre}</Text>
      <P small muted>{title(o)}</P>
      <P small><Text style={{ fontWeight: '900', color: C.ink }}>{money(o.total)}</Text>{o.entrega?.mode ? ' · ' + modeLabel(o.entrega.mode) : ''}{o.channel === 'store' ? ' · ' + L('mostrador', 'counter') : ''}</P>
    </Pressable>
  );
  const col = (k: string, label: string, rows: Order[]) => (
    <View key={k} style={{ flexGrow: 1, flexBasis: 200, minWidth: 0, backgroundColor: C.cream, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 8, gap: 6 }}>
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
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{L('Hoy · ', 'Today · ') + new Date().toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kp.map(([k, label, v]) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => { if (k !== 'vendido') { setStatus(k); setView('lista'); } }}
                style={{ flexGrow: 1, flexBasis: 150, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
                <P small muted style={{ fontWeight: '800' }}>{label}</P>
                <Text style={{ fontSize: 22, fontWeight: '900', color: k === 'verificar' && v !== '0' ? '#7A4A00' : C.ink }}>{v}</Text>
              </Pressable>
            ))}
          </View>
          <Seg
            options={[
              { v: 'tablero' as const, label: L('Pedidos', 'Orders'), count: all.filter((o) => o.status === 'verificar').length },
              { v: 'sol' as const, label: L('Solicitudes', 'Requests'), count: plansReq.length + idsReq.length },
              { v: 'auto' as const, label: L('Automático', 'Automatic') },
              { v: 'lista' as const, label: L('Lista', 'List') },
            ]}
            value={view}
            onChange={setView}
          />
          {view === 'tablero' ? (
            <View onLayout={(e) => setBoardW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              {!wideBoard ? detail : null}
              {col('verificar', L('Verificar pago', 'Verify payment'), all.filter((o) => o.status === 'verificar'))}
              {col('proceso', L('En proceso', 'In progress'), all.filter((o) => o.status === 'proceso'))}
              {col('completado', L('Entregados hoy', 'Delivered today'), all.filter((o) => o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today))}
              {wideBoard ? detail : null}
            </View>
          ) : view === 'sol' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {!plansReq.length && !idsReq.length ? <Empty>{L('No hay solicitudes pendientes.', 'No pending requests.')}</Empty> : null}
              {plansReq.map((p) => (
                <View key={p.id} style={{ flexGrow: 1, flexBasis: 300, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n="credito" size={40} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.ink }}>{(p.kind === 'credito' ? L('Crédito · ', 'Credit · ') : L('Apartado · ', 'Layaway · ')) + p.item_name}</Text>
                      <P small muted>{`${p.cliente_nombre} · ${p.n} ${L('pagos', 'payments')} ${p.freq} · ${L('enganche', 'down')} ${money(p.down)}`}</P>
                    </View>
                    <View style={{ backgroundColor: '#FCEBC7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ fontSize: 11.5, fontWeight: '900', color: '#8A5A00' }}>{L('Por aprobar', 'To approve')}</Text></View>
                  </View>
                  <Btn small title={L('Revisar y aprobar', 'Review and approve')} onPress={() => router.push('/tienda/creditos')} style={{ alignSelf: 'flex-start' }} />
                </View>
              ))}
              {idsReq.map((d) => (
                <View key={d.user_id} style={{ flexGrow: 1, flexBasis: 300, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n="tramite" size={40} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.ink }}>{L('Identificación · ', 'ID · ') + d.tipo}</Text>
                      <P small muted>{`${d.nombre} · ${d.member_code}`}</P>
                    </View>
                    <View style={{ backgroundColor: '#FCEBC7', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ fontSize: 11.5, fontWeight: '900', color: '#8A5A00' }}>{L('Por revisar', 'To review')}</Text></View>
                  </View>
                  <Btn small title={L('Revisar', 'Review')} onPress={() => router.push('/tienda/identificaciones')} style={{ alignSelf: 'flex-start' }} />
                </View>
              ))}
            </View>
          ) : view === 'auto' ? (
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 6 }}>
              {[
                ['bell', L(`${all.filter((o) => o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today).length} avisos de "pedido listo" enviados hoy`, `${all.filter((o) => o.status === 'completado' && new Date(o.updated_at || o.created_at).toDateString() === today).length} "order ready" notices sent today`), L('Le llegan al cliente en la app', 'Customers get them in the app')],
                ['cash', L(`${all.filter((o) => o.paid_at && new Date(o.paid_at).toDateString() === today).length} pagos confirmados hoy`, `${all.filter((o) => o.paid_at && new Date(o.paid_at).toDateString() === today).length} payments confirmed today`), L('Cada cliente recibe su comprobante', 'Each customer gets a receipt')],
                ['star', L('Solicitud de calificación al entregar', 'Rating request after delivery'), L('Sale sola en cada pedido completado', 'Sent automatically on every completed order')],
                ['gift', L('Puntos al comprar', 'Points on purchases'), L('Se suman solos con cada venta', 'Added automatically with each sale')],
                ['image', L(`${nStories} historias al aire`, `${nStories} stories live`), L('Se quitan solas al vencer', 'Removed automatically when they expire')],
              ].map(([ic, t, sub], i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon n={ic} size={22} color={C.brown} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.ink }}>{t}</Text>
                    <P small muted>{sub}</P>
                  </View>
                </View>
              ))}
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
