import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';

import { BackBar, Btn, Card, Field, H1, IcoBox, Label, Loading, Note, P, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useStores } from '@/lib/data';
import { clearCart } from '@/lib/cart';
import { setDraft, useDraft } from '@/lib/draft';
import { money, mxn } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order } from '@/lib/types';

export default function Pago() {
  const { L, nm } = useLang();
  const { session, profile } = useAuth();
  const d = useDraft();
  const { data: stores } = useStores();
  const [zelleName, setZelleName] = useState(profile ? `${profile.nombre} ${profile.apellidos}`.trim() : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!d) return <Redirect href="/inicio" />;
  if (!stores) return <Loading />;
  const st = stores.find((x) => x.id === d.storeId);
  if (!st) return <Loading />;

  const total = d.kind === 'send' ? d.monto + d.fee : d.kind === 'shop' ? d.subtotal + d.fee : d.base + d.fee;

  const submit = async () => {
    if (!session) return;
    setErr('');
    setBusy(true);
    try {
      const path = null;
      const rpc =
        d.kind === 'send'
          ? supabase.rpc('create_send_order', { p_store: d.storeId, p_beneficiary: d.beneficiaryId, p_monto: d.monto, p_captura: path, p_zelle_nombre: zelleName.trim() })
          : d.kind === 'shop'
          ? supabase.rpc('create_shop_order', {
              p_store: d.storeId,
              p_items: d.items.map((x) => ({ variant_id: x.variant_id, qty: x.qty })),
              p_entrega: d.entrega,
              p_captura: path,
              p_zelle_nombre: zelleName.trim(),
            })
          : supabase.rpc('create_service_order', {
              p_store: d.storeId,
              p_service: d.serviceId,
              p_option: d.option ?? 0,
              p_amount: d.amount ?? 0,
              p_data: d.data,
              p_entrega: d.entrega,
              p_captura: path,
              p_zelle_nombre: zelleName.trim(),
            });
      const { data, error } = await rpc.single<Order>();
      if (error) throw error;
      if (d.kind === 'shop') clearCart();
      setDraft(null);
      router.replace({ pathname: '/pedido/[id]', params: { id: data.id, nuevo: '1' } });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen wall="send">
      <BackBar steps={[d.kind === 'send' ? L('Envío', 'Transfer') : d.kind === 'shop' ? L('Carrito', 'Cart') : L('Servicio', 'Service'), L('Pago', 'Payment'), L('Listo', 'Done')]} cur={1} />
      <H1>{L('Revisa y haz tu pedido', 'Review and place your order')}</H1>

      <Card>
        <Row gap={12} style={{ flexWrap: 'nowrap' }}>
          <IcoBox n={d.kind === 'send' ? 'send' : d.kind === 'shop' ? 'bag' : d.icon} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>
              {d.kind === 'send'
                ? L('Envío a ', 'Transfer to ') + d.beneficiaryName
                : d.kind === 'shop'
                  ? L('Tu compra', 'Your purchase')
                  : nm(d.serviceName) + (d.optionLabel ? ' · ' + d.optionLabel : '')}
            </Text>
            <P small muted>{st.nombre}</P>
          </View>
        </Row>
        {d.kind === 'send' ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}><P>{L('Envías', 'You send')}</P><P>{money(d.monto)}</P></Row>
            <Row style={{ justifyContent: 'space-between' }}><P>{L('Recibe aprox.', 'They receive approx.')}</P><P>{mxn(d.mxn)}</P></Row>
          </>
        ) : d.kind === 'shop' ? (
          d.items.map((x) => (
            <Row key={x.variant_id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <P style={{ flex: 1 }}>{`${x.qty} × ${x.name} · ${x.label}`}</P>
              <P>{money(x.qty * x.price)}</P>
            </Row>
          ))
        ) : (
          <Row style={{ justifyContent: 'space-between' }}><P>{L('Servicio', 'Service')}</P><P>{money(d.base)}</P></Row>
        )}
        {d.fee > 0 ? <Row style={{ justifyContent: 'space-between' }}><P>{L('Comisión y cargos', 'Fees')}</P><P>{money(d.fee)}</P></Row> : null}
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
          <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L('Total a pagar', 'Total to pay')}</Text>
          <Text style={{ fontWeight: '900', fontSize: 22, color: C.ink }}>{money(total)}</Text>
        </Row>
      </Card>

      <Card>
        <Label>{L('¿Cómo vas a pagar?', 'How will you pay?')}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.md, borderWidth: 2, borderColor: C.brown, backgroundColor: C.cream }}>
          <IcoBox n="phone" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>Zelle</Text>
            <P small muted>{L('Al hacer tu pedido te damos el correo o teléfono de Zelle de la tienda, el monto exacto y la nota.', "When you place your order we show the store's Zelle email or phone, the exact amount and the memo.")}</P>
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 6, borderColor: C.brown, backgroundColor: '#fff' }} />
        </View>
        <Field label={L('Nombre con el que vas a pagar en Zelle', 'Name you will pay with on Zelle')} value={zelleName} onChangeText={setZelleName} hint={L(`Así ${st.nombre} encuentra tu pago más rápido.`, `This helps ${st.nombre} find your payment faster.`)} />
      </Card>

      {err ? <Note kind="red">{err}</Note> : null}
      <Btn title={L(`Hacer pedido · ${money(total)}`, `Place order · ${money(total)}`)} onPress={submit} loading={busy} icon="check" />
      <Note kind="blue" icon="shield">{L('La tienda confirma tu pago, hace tu trámite y te manda el comprobante aquí mismo.', 'The store confirms your payment, does your service and sends the receipt right here.')}</Note>
    </Screen>
  );
}
