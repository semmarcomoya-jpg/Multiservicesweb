import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { orderIcon, useOrderText } from '@/components/orders';
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

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setO(data as Order);
    const { data: e } = await supabase.from('order_events').select('*').eq('order_id', id).order('id');
    setEv((e as OrderEvent[]) ?? []);
    if (data?.ticket_path) setTicket(await signedUrl('comprobantes', data.ticket_path));
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
  const steps = [
    ['verificar', L('Recibimos tu pedido', 'We got your order')],
    ['proceso', L('Pago confirmado, lo estamos haciendo', 'Payment confirmed, working on it')],
    ['completado', L('¡Listo! Ya tienes tu comprobante', 'Done! Your receipt is ready')],
  ];
  const idx = o.status === 'rechazado' ? -1 : steps.findIndex((x) => x[0] === o.status);

  return (
    <Screen>
      <BackBar title={o.folio} />
      {nuevo ? <Note kind="blue" icon="check">{L('¡Pedido enviado! Te avisamos aquí cuando la tienda confirme tu pago.', "Order sent! We'll update you here when the store confirms your payment.")}</Note> : null}
      <Row gap={12} style={{ flexWrap: 'nowrap' }}>
        <IcoBox n={orderIcon(o)} size={52} />
        <View style={{ flex: 1 }}>
          <H1 style={{ fontSize: 22 }}>{title(o)}</H1>
          <P muted>{money(o.total)} · {o.folio}</P>
        </View>
        <StatusChip status={o.status} />
      </Row>

      {o.attended_name ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '900', color: C.ink }}>{o.attended_name.charAt(0)}</Text>
          </View>
          <Text style={{ fontWeight: '800', color: C.ink }}>{(o.status === 'completado' ? L('Te atendió ', 'You were helped by ') : L('Te atiende ', 'Helping you: ')) + o.attended_name}</Text>
        </Card>
      ) : null}

      {o.code && mode && mode !== 'digital' && o.status !== 'completado' && o.status !== 'rechazado' ? (
        <Card style={{ alignItems: 'center' }}>
          <Label>{L('Tu código de entrega', 'Your pickup code')}</Label>
          <Text style={{ fontSize: 40, fontWeight: '900', letterSpacing: 10, color: C.brownDark }}>{o.code}</Text>
          <P small muted style={{ textAlign: 'center' }}>
            {modeLabel(mode)}
            {o.entrega?.time ? ' · ' + o.entrega.time : ''}. {L('Díselo a quien te entregue. No lo compartas con nadie más.', 'Tell it to whoever hands you the order. Do not share it with anyone else.')}
          </P>
          {mode === 'curb' && o.status === 'proceso' && !o.entrega?.arrived ? (
            <Btn icon="car" title={L('Ya llegué', "I'm here")} onPress={async () => { await supabase.rpc('mark_arrived', { p_order: o.id }); load(); }} />
          ) : null}
          {o.entrega?.arrived ? <Note kind="blue">{L('Avisamos a la tienda que ya llegaste.', 'We told the store you are here.')}</Note> : null}
        </Card>
      ) : null}

      {o.status === 'rechazado' ? (
        <Note kind="red" icon="x">{L('La tienda no pudo confirmar tu pago. ', "The store couldn't confirm your payment. ") + (o.reject_reason || L('Comunícate con la tienda.', 'Please contact the store.'))}</Note>
      ) : (
        <Card>
          {steps.map(([k, label], i) => (
            <Row key={k} gap={12} style={{ flexWrap: 'nowrap' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: i <= idx ? C.brown : C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontWeight: i === idx ? '900' : '600', color: i <= idx ? C.ink : C.muted }}>{label}</Text>
            </Row>
          ))}
        </Card>
      )}

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
