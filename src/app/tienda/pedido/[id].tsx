import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { orderIcon, useOrderText } from '@/components/orders';
import { BackBar, Btn, Card, Field, H1, H2, IcoBox, Label, Loading, Note, P, Row, Screen, StatusChip } from '@/components/ui';
import { digits, money, mxn } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order, OrderEvent } from '@/lib/types';
import { pickImage, signedUrl, uploadImage, type Picked } from '@/lib/upload';

export default function TiendaPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { L, lang } = useLang();
  const { title, modeLabel, ago } = useOrderText();
  const [o, setO] = useState<Order | null>(null);
  const [ev, setEv] = useState<OrderEvent[]>([]);
  const [captura, setCaptura] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [pin, setPin] = useState('');
  const [checks, setChecks] = useState({ monto: false, nombre: false, nota: false });
  const [folioProv, setFolioProv] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<Picked | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    const ord = data as Order;
    setO(ord);
    setFolioProv(ord?.folio_prov || '');
    const { data: e } = await supabase.from('order_events').select('*').eq('order_id', id).order('id');
    setEv((e as OrderEvent[]) ?? []);
    if (ord?.captura_path) setCaptura(await signedUrl('capturas', ord.captura_path));
    const ph: Record<string, string> = {};
    for (const x of ord?.data || []) if (x.type === 'photo' && x.value) ph[x.k] = (await signedUrl('capturas', x.value)) || '';
    setPhotos(ph);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!o) return <Loading />;
  const mode = o.entrega?.mode || 'digital';
  const needCode = !!o.code && mode !== 'digital';
  const open = o.status === 'verificar' || o.status === 'proceso';

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>) => {
    setErr('');
    setBusy(key);
    const { error } = await fn();
    setBusy('');
    if (error) setErr(errMsg(error));
    else load();
  };

  const take = () => run('take', () => supabase.rpc('take_order', { p_order: o.id, p_pin: pin }).then((r) => { setPin(''); return r; }));
  const advance = (status: string, extra: Record<string, string | null> = {}) =>
    run(status, () => supabase.rpc('advance_order', { p_order: o.id, p_status: status, ...extra }));

  const complete = async () => {
    setErr('');
    let path: string | null = null;
    if (ticket) {
      try {
        setBusy('up');
        path = await uploadImage('comprobantes', o.store_id, ticket);
      } catch (e) {
        setBusy('');
        setErr(errMsg(e));
        return;
      }
    }
    advance('completado', { p_folio_prov: folioProv.trim() || null, p_ticket: path, p_code: needCode ? code : null });
  };

  const copy = async (label: string, v: string) => {
    await Clipboard.setStringAsync(v);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  const datos: [string, string][] = [];
  if (o.kind === 'send' && o.beneficiary) {
    const b = o.beneficiary;
    datos.push([L('Beneficiario', 'Recipient'), `${b.nombre} ${b.apellidos}`], [L('Teléfono MX', 'MX phone'), b.telefono], [L('Lugar', 'Location'), `${b.ciudad}, ${b.estado}`]);
    if (b.metodo === 'cuenta') datos.push([L('Banco', 'Bank'), b.banco], [b.cuenta.length === 18 ? 'CLABE' : L('Tarjeta', 'Card'), b.cuenta]);
    else datos.push([L('Retiro en', 'Pickup at'), b.red]);
    datos.push([L('Monto USD', 'Amount USD'), Number(o.monto).toFixed(2)], [L('Tipo de cambio', 'Rate'), Number(o.rate).toFixed(2)], [L('Recibe', 'Receives'), mxn(o.mxn)]);
  }
  if (o.kind === 'service') {
    datos.push([L('Monto', 'Amount'), Number(o.monto).toFixed(2)]);
    for (const x of o.data || []) if (x.type !== 'photo') datos.push([lang === 'es' ? x.es : x.en, x.value || '—']);
  }
  if (o.kind === 'shop') for (const x of o.items || []) datos.push([`${x.qty} × ${x.name}`, `${x.label} · ${money(x.qty * x.price)}`]);
  if (mode !== 'digital') datos.push([L('Entrega', 'Delivery'), modeLabel(mode) + (o.entrega?.time ? ' ' + o.entrega.time : '') + (o.entrega?.address ? ' · ' + o.entrega.address + ' ' + (o.entrega.zip || '') : '')]);

  return (
    <Screen wide>
      <BackBar title={o.folio} />
      <Card>
        <Row gap={12} style={{ flexWrap: 'nowrap' }}>
          <IcoBox n={orderIcon(o)} size={48} />
          <View style={{ flex: 1 }}>
            <P small muted>{o.folio} · {ago(o.created_at)}</P>
            <H1 style={{ fontSize: 22 }}>{title(o)} · {money(o.total)}</H1>
            <P small>{L('Cliente: ', 'Customer: ')}{o.cliente_nombre} · {o.cliente_code}</P>
          </View>
          <StatusChip status={o.status} />
        </Row>
        {o.entrega?.arrived && o.status === 'proceso' ? <Note kind="gold" icon="car">{L('¡El cliente ya llegó! Llévale su pedido al carro.', 'The customer is here! Take the order to their car.')}</Note> : null}
      </Card>

      {open && !o.attended_by ? (
        <Card>
          <H2>{L('¿Quién atiende este pedido?', 'Who is handling this order?')}</H2>
          <P muted small>{L('Escribe tu clave. El pedido queda a tu nombre y el cliente verá quién lo atendió.', 'Enter your code. The order is assigned to you and the customer will see who helped them.')}</P>
          <Row style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
            <Field label={L('Clave de empleado', 'Employee code')} value={pin} onChangeText={(v) => setPin(digits(v))} secure keyboardType="number-pad" maxLength={6} style={{ maxWidth: 260 }} />
            <Btn title={L('Entrar', 'Enter')} onPress={take} loading={busy === 'take'} disabled={pin.length < 4} />
          </Row>
        </Card>
      ) : null}
      {o.attended_name ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '900' }}>{o.attended_name.charAt(0)}</Text>
          </View>
          <Text style={{ fontWeight: '900', color: C.ink, flex: 1 }}>{L('Atiende: ', 'Handled by: ') + o.attended_name}</Text>
        </Card>
      ) : null}

      {err ? <Note kind="red" icon="x">{err}</Note> : null}

      <Card>
        <H2>1 · {L('Verifica el pago en tu banco', 'Verify the payment in your bank')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          {captura ? <Image source={{ uri: captura }} style={{ width: 180, height: 260, borderRadius: R.md, backgroundColor: C.cream }} resizeMode="contain" /> : o.status === 'verificar' ? <Note kind="gold" icon="clock">{L('El cliente no subió captura. Búscalo en tu banco por el monto y la nota.', 'No screenshot from the customer. Look it up in your bank by amount and memo.')}</Note> : null}
          <View style={{ flex: 1, minWidth: 220, gap: 8 }}>
            {o.status === 'verificar' ? (
              <>
                {([
                  ['monto', L('Llegó el monto exacto: ', 'The exact amount arrived: ') + money(o.total)],
                  ['nombre', L('El remitente es ', 'The sender is ') + o.zelle_nombre],
                  ['nota', L('La nota dice ', 'The memo says ') + `"Pedido ${o.folio}"` + (o.cliente_code ? L(' (o el código ', ' (or the code ') + o.cliente_code + ')' : '')],
                ] as const).map(([k, label]) => (
                  <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: checks[k] }} onPress={() => setChecks((p) => ({ ...p, [k]: !p[k] }))}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: R.md, backgroundColor: checks[k] ? C.blueSoft : C.cream }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checks[k] ? C.blue : C.line2, backgroundColor: checks[k] ? C.blue : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      {checks[k] ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>✓</Text> : null}
                    </View>
                    <Text style={{ flex: 1, fontWeight: '700', color: C.ink }}>{label}</Text>
                  </Pressable>
                ))}
                <Row>
                  <Btn title={L('Pago recibido', 'Payment received')} icon="check" disabled={!o.attended_by || !(checks.monto && checks.nombre && checks.nota)} loading={busy === 'proceso'} onPress={() => advance('proceso')} />
                </Row>
                {!o.attended_by ? <P small muted>{L('Primero escribe tu clave de empleado.', 'Enter your employee code first.')}</P> : null}
              </>
            ) : (
              <P>{o.status === 'rechazado' ? L('Pedido rechazado. ', 'Order rejected. ') + o.reject_reason : L(`Pago de ${money(o.total)} confirmado.`, `Payment of ${money(o.total)} confirmed.`)}</P>
            )}
          </View>
        </Row>
      </Card>

      <Card>
        <H2>2 · {o.kind === 'send' ? L('Haz el envío en el portal', 'Send it in the provider portal') : o.kind === 'shop' ? L('Prepara el pedido', 'Prepare the order') : L('Realiza el servicio', 'Do the service')}</H2>
        <P small muted>{L('Toca un dato para copiarlo.', 'Tap a field to copy it.')}</P>
        <Row gap={8} style={{ alignItems: 'stretch' }}>
          {datos.map(([k, v]) => (
            <Pressable key={k} accessibilityRole="button" onPress={() => copy(k, v)} style={{ flexGrow: 1, flexBasis: 200, padding: 10, borderRadius: R.sm, backgroundColor: C.cream, borderWidth: 1, borderColor: C.line }}>
              <P small muted>{copied === k ? L('¡Copiado!', 'Copied!') : k}</P>
              <Text style={{ fontWeight: '900', color: C.ink }}>{v}</Text>
            </Pressable>
          ))}
        </Row>
        {Object.keys(photos).length ? (
          <Row>
            {Object.entries(photos).map(([k, u]) => (u ? <Image key={k} source={{ uri: u }} style={{ width: 160, height: 120, borderRadius: R.sm }} /> : null))}
          </Row>
        ) : null}
      </Card>

      {o.status === 'proceso' ? (
        <Card>
          <H2>3 · {needCode ? L('Entrega al cliente', 'Hand it to the customer') : L('Sube el comprobante', 'Upload the receipt')}</H2>
          {needCode ? (
            <Field label={L('Código que te dicta el cliente', 'Code the customer tells you')} value={code} onChangeText={(v) => setCode(digits(v))} keyboardType="number-pad" maxLength={4}
              error={code.length === 4 && code !== o.code ? L('El código no coincide', 'Code does not match') : ''} style={{ maxWidth: 260 }} />
          ) : null}
          {o.kind === 'send' ? <Field label={L('Folio del envío (MTCN)', 'Transfer reference (MTCN)')} value={folioProv} onChangeText={setFolioProv} style={{ maxWidth: 360 }} /> : null}
          <Pressable accessibilityRole="button" onPress={async () => setTicket((await pickImage()) || ticket)}
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, borderRadius: R.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 420 }}>
            {ticket ? <Image source={{ uri: ticket.uri }} style={{ width: 60, height: 80, borderRadius: 8 }} /> : <IcoBox n="camera" size={44} />}
            <Text style={{ fontWeight: '800', color: C.ink }}>{ticket ? L('Cambiar foto', 'Change photo') : needCode ? L('Foto del comprobante (opcional)', 'Receipt photo (optional)') : L('Foto del comprobante', 'Receipt photo')}</Text>
          </Pressable>
          <Row>
            <Btn kind="blue" icon="check" title={needCode ? L('Entregar y completar', 'Hand over and complete') : L('Enviar comprobante al cliente', 'Send receipt to customer')}
              disabled={needCode ? code !== o.code : !ticket || (o.kind === 'send' && !folioProv.trim())}
              loading={busy === 'completado' || busy === 'up'} onPress={complete} />
          </Row>
        </Card>
      ) : null}

      {open && o.attended_by ? (
        <Card>
          <Label>{L('¿Hay un problema con el pago?', 'Is there a problem with the payment?')}</Label>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={L('Motivo (lo verá el cliente)', 'Reason (the customer will see it)')} value={reason} onChangeText={setReason} />
            <Btn kind="danger" title={L('Rechazar y avisar', 'Reject and notify')} disabled={!reason.trim()} loading={busy === 'rechazado'} onPress={() => advance('rechazado', { p_reason: reason.trim() })} />
          </Row>
        </Card>
      ) : null}

      {ev.length ? (
        <Card>
          <Label>{L('Bitácora', 'Activity log')}</Label>
          {ev.map((x) => (
            <Row key={x.id} style={{ justifyContent: 'space-between' }}>
              <P small>{x.act}</P>
              <P small muted>{x.by_name} · {new Date(x.created_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</P>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
