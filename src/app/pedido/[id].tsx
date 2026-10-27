import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/components/Text';

import { orderIcon, useOrderText } from '@/components/orders';
import { PayZelle } from '@/components/PayZelle';
import { OrderStatusCard } from '@/components/OrderStatusCard';
import { RatingCard } from '@/components/RatingCard';
import { useAuth } from '@/lib/auth';
import { useStores } from '@/lib/data';
import { BackBar, Btn, Card, H1, IcoBox, Label, Loading, Note, P, Row, Screen, StatusChip } from '@/components/ui';
import { money, mxn } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order, OrderEvent } from '@/lib/types';
import { signedUrl } from '@/lib/upload';

export default function PedidoCliente() {
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const { L, nm, lang } = useLang();
  const { title, modeLabel } = useOrderText();
  const [o, setO] = useState<Order | null>(null);
  const [ev, setEv] = useState<OrderEvent[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);
  const [captura, setCaptura] = useState<string | null>(null);
  const { session } = useAuth();
  const { data: stores } = useStores();

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setO(data as Order);
    const { data: e } = await supabase.from('order_events').select('*').eq('order_id', id).order('id');
    setEv((e as OrderEvent[]) ?? []);
    if (data?.ticket_path) setTicket(await signedUrl('comprobantes', data.ticket_path));
    setCaptura(data?.captura_path ? await signedUrl('capturas', data.captura_path) : null);
  }, [id]);

  useEffect(() => {
    load();
    // Se actualiza solo cuando la tienda avanza el pedido
    const ch = supabase
      .channel('order-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  if (!o) return <Loading />;
  const mode = o.entrega?.mode;

  return (
    <Screen wall="send">
      <BackBar />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: C.ink, lineHeight: 38 }}>{L('Pedido ', 'Order ') + o.folio}</Text>
        <P small muted style={{ paddingBottom: 4 }}>{L('Pedido el ', 'Ordered on ') + new Date(o.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}</P>
      </View>
      <Row gap={10} style={{ flexWrap: 'nowrap' }}>
        <IcoBox n={orderIcon(o)} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16 }} numberOfLines={2}>{title(o)}</Text>
          <P small muted>{money(o.total)}</P>
        </View>
      </Row>

      {session ? <PayZelle order={o} store={(stores || []).find((s) => s.id === o.store_id)} userId={session.user.id} captura={captura} onChanged={load} /> : null}

      <OrderStatusCard o={o} />

      {o.code && mode && mode !== 'digital' && o.status !== 'completado' && o.status !== 'rechazado' ? (
        <View style={{ backgroundColor: C.card, borderRadius: 24, borderWidth: 2.5, borderColor: C.gold, padding: 22, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', letterSpacing: 2.5, color: C.muted }}>{L('CÓDIGO PARA RECOGER', 'PICKUP CODE')}</Text>
          <Text selectable style={{ fontSize: 64, fontWeight: '900', letterSpacing: 14, color: C.brownDark, lineHeight: 72, paddingLeft: 14 }}>{o.code}</Text>
          <P style={{ textAlign: 'center' }}>
            {mode === 'home'
              ? L('Díselo a quien te entregue. No lo compartas con nadie más.', 'Tell it to the delivery person. Do not share it with anyone else.')
              : L('Muestra este código en el mostrador.', 'Show this code at the counter.')}
          </P>
          <P small muted style={{ textAlign: 'center' }}>{modeLabel(mode)}{o.entrega?.time ? ' · ' + o.entrega.time : ''}</P>
          {mode === 'curb' && o.status === 'proceso' && !o.entrega?.arrived ? (
            <Btn icon="car" title={L('Ya llegué', "I'm here")} onPress={async () => { await supabase.rpc('mark_arrived', { p_order: o.id }); load(); }} />
          ) : null}
          {o.entrega?.arrived ? <Note kind="blue">{L('Avisamos a la tienda que ya llegaste.', 'We told the store you are here.')}</Note> : null}
        </View>
      ) : null}

      <RatingCard order={o} />

      {ticket ? (
        <Card>
          <Label>{L('Tu comprobante', 'Your receipt')}</Label>
          <Image source={{ uri: ticket }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.md, backgroundColor: C.cream }} resizeMode="contain" />
          {o.folio_prov ? <P>{L('Folio: ', 'Reference: ') + o.folio_prov}</P> : null}
        </Card>
      ) : null}

      <Card>
        <Label>{L('Detalles', 'Details')}</Label>
        {o.kind === 'send' && o.beneficiary ? (
          <>
            <P>{L('Recibe: ', 'Recipient: ')}{`${o.beneficiary.nombre} ${o.beneficiary.apellidos}`}</P>
            <P>{o.beneficiary.metodo === 'cuenta' ? `${o.beneficiary.banco} ···${o.beneficiary.cuenta.slice(-4)}` : L('Retiro en ', 'Pickup at ') + o.beneficiary.red}</P>
            <P>{L('Envías ', 'You send ') + money(o.monto)} · {L('recibe ', 'receives ') + mxn(o.mxn)}</P>
            <P small muted>1 USD = {Number(o.rate).toFixed(2)} MXN</P>
          </>
        ) : null}
        {o.kind === 'shop'
          ? (o.items || []).map((x) => <P key={x.variant_id}>{`${x.qty} × ${x.name} · ${x.label} — ${money(x.qty * x.price)}`}</P>)
          : null}
        {o.kind === 'service'
          ? (o.data || []).filter((x) => x.type !== 'photo' && x.value).map((x) => <P key={x.k}>{(lang === 'es' ? x.es : x.en) + ': ' + x.value}</P>)
          : null}
        {mode && mode !== 'digital' ? <P>{modeLabel(mode)}{o.entrega?.time ? ' · ' + o.entrega.time : ''}{o.entrega?.address ? ' · ' + o.entrega.address : ''}</P> : null}
        {Number(o.fee) > 0 ? <P small muted>{L('Comisión y cargos: ', 'Fees: ') + money(o.fee)}</P> : null}
        {o.service_name?.opcion ? <P small muted>{nm(o.service_name.opcion)}</P> : null}
      </Card>

      {ev.length ? (
        <Card>
          <Label>{L('Historial', 'History')}</Label>
          {ev.map((x) => (
            <Row key={x.id} style={{ justifyContent: 'space-between' }}>
              <P small>{x.act}</P>
              <P small muted>{new Date(x.created_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</P>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
