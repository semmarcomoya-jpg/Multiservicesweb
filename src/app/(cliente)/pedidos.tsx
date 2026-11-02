import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useOrderText } from '@/components/orders';
import { Scene, sceneFor, type SceneName } from '@/components/scenes';
import { Text } from '@/components/Text';
import { Btn, Empty, H1, Icon, Loading, P, Screen, SearchBox, Seg, TopBar, matches } from '@/components/ui';
import { useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order } from '@/lib/types';

type Tab = 'act' | 'past' | 'rate';

const sceneOf = (o: Order): SceneName =>
  o.kind === 'send' ? 'envio' : o.kind === 'shop' ? 'celular' : o.kind === 'abono' ? 'credito' : sceneFor(o.service_name?.icon, o.service_name?.cat);

export default function Pedidos() {
  const { L } = useLang();
  const { orders } = useMyOrders(100);
  const { data: stores } = useStores();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('act');
  const [rated, setRated] = useState<Set<string> | null>(null);
  const { title, ago } = useOrderText();
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
  const storeName = (id: string) => (stores || []).find((s) => s.id === id)?.nombre.replace('Castillo · ', '') || '';
  const open = (o: Order) => router.push({ pathname: '/pedido/[id]', params: { id: o.id } });

  const repeat = (o: Order) => {
    if (o.kind === 'send') return router.push('/enviar');
    if (o.kind === 'service' && o.service_id) return router.push({ pathname: '/servicio/[id]', params: { id: o.service_id } });
    if (o.kind === 'shop') return router.push('/productos');
    return router.push('/credito');
  };

  const status = (o: Order) =>
    o.status === 'verificar'
      ? { t: L('Revisando tu pago', 'Checking your payment'), bg: C.goldSoft, fg: C.goldInk, p: 35 }
      : o.status === 'proceso'
        ? { t: o.code ? L('Listo para recoger', 'Ready for pickup') : L('En proceso', 'In progress'), bg: C.blueSoft, fg: C.blueInk, p: o.code ? 90 : 70 }
        : o.status === 'completado'
          ? { t: L('Completado', 'Completed'), bg: '#DDF1E4', fg: '#1E5B35', p: 100 }
          : { t: L('Rechazado', 'Rejected'), bg: C.redSoft, fg: C.red, p: 100 };

  const Art = ({ o }: { o: Order }) => (
    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Scene n={sceneOf(o)} size={40} />
    </View>
  );

  return (
    <Screen wall="send">
      <TopBar />
      <H1>{L('Mis pedidos', 'My orders')}</H1>
      {!orders ? <Loading /> : null}
      {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
      {orders && orders.length ? (
        <Seg
          options={[
            { v: 'act' as Tab, label: L('Activos', 'Active'), count: active.length },
            { v: 'past' as Tab, label: L('Pasados', 'Past') },
            { v: 'rate' as Tab, label: L('Por calificar', 'To rate'), count: toRate.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      {list.length > 4 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por folio, servicio o persona', 'Search by ref, service or person')} count={shown.length} /> : null}
      {orders && orders.length && !list.length ? (
        <Empty>{tab === 'act' ? L('No tienes pedidos en curso.', 'No orders in progress.') : tab === 'past' ? L('Aún no hay pedidos terminados.', 'No finished orders yet.') : L('¡Gracias! Ya calificaste todo.', 'Thanks! You have rated everything.')}</Empty>
      ) : null}

      {/* Activos: tarjeta con barra de avance y código */}
      {tab === 'act'
        ? shown.map((o) => {
            const s = status(o);
            return (
              <Pressable key={o.id} accessibilityRole="button" onPress={() => open(o)}
                style={({ pressed }) => ({ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Art o={o} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: '800', fontSize: 14.5, color: C.ink }} numberOfLines={1}>{title(o)} · {money(o.total)}</Text>
                    <Text style={{ fontSize: 12.5, color: C.muted }}>{[o.folio, storeName(o.store_id)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={{ backgroundColor: s.bg, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
                    <Text style={{ color: s.fg, fontWeight: '900', fontSize: 11.5 }}>{s.t}</Text>
                  </View>
                </View>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' }}>
                  <View style={{ width: `${s.p}%`, height: '100%', backgroundColor: C.brown }} />
                </View>
                {o.code ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, fontSize: 12.5, color: C.muted }}>{L('Código para recoger', 'Pickup code')}</Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', letterSpacing: 6, color: C.strong }}>{o.code}</Text>
                  </View>
                ) : (
                  <P small muted>{L('Te avisamos al celular cuando lo confirmen.', 'We will notify you when it is confirmed.')}</P>
                )}
              </Pressable>
            );
          })
        : null}

      {/* Pasados y por calificar: renglones con su acción */}
      {tab !== 'act' && shown.length ? (
        <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line }}>
          {shown.map((o, i) => (
            <Pressable key={o.id} accessibilityRole="button" onPress={() => open(o)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Art o={o} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '800', fontSize: 14.5, color: C.ink }} numberOfLines={1}>{title(o)}</Text>
                <Text style={{ fontSize: 12.5, color: C.muted }}>{`${o.folio} · ${money(o.total)} · ${ago(o.created_at)}`}</Text>
              </View>
              {tab === 'past' && o.status === 'completado' && o.kind !== 'abono' ? (
                <Btn small kind="ghost" icon="repeat" title={L('Repetir', 'Repeat')} onPress={() => repeat(o)} />
              ) : tab === 'rate' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#E8A317', fontSize: 18 }}>★</Text>
                  <Text style={{ fontWeight: '800', color: C.brown }}>{L('Calificar', 'Rate')}</Text>
                </View>
              ) : o.status === 'rechazado' ? (
                <Text style={{ fontWeight: '800', color: C.red, fontSize: 12 }}>{L('Rechazado', 'Rejected')}</Text>
              ) : (
                <Icon n="arrow" size={16} color={C.muted} />
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
