import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
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
import { pickImage, uploadImage, type Picked } from '@/lib/upload';

export default function Pago() {
  const { L, nm } = useLang();
  const { session, profile } = useAuth();
  const d = useDraft();
  const { data: stores } = useStores();
  const [shot, setShot] = useState<Picked | null>(null);
  const [zelleName, setZelleName] = useState(profile ? `${profile.nombre} ${profile.apellidos}`.trim() : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  if (!d) return <Redirect href="/inicio" />;
  if (!stores) return <Loading />;
  const st = stores.find((x) => x.id === d.storeId);
  if (!st) return <Loading />;

  const total = d.kind === 'send' ? d.monto + d.fee : d.kind === 'shop' ? d.subtotal + d.fee : d.base + d.fee;
  const memo = profile?.member_code || '';

  const copy = async (label: string, txt: string) => {
    await Clipboard.setStringAsync(txt);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  };

  const submit = async () => {
    if (!session || !shot) return;
    setErr('');
    setBusy(true);
    try {
      const path = await uploadImage('capturas', session.user.id, shot);
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

  const CopyRow = ({ label, value }: { label: string; value: string }) => (
    <Pressable accessibilityRole="button" accessibilityHint={L('Toca para copiar', 'Tap to copy')} onPress={() => copy(label, value)} style={{ backgroundColor: C.cream, borderRadius: R.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <P small muted>{label}</P>
        <Text style={{ fontWeight: '900', color: C.ink, fontSize: 17 }}>{value}</Text>
      </View>
      <Text style={{ fontWeight: '800', color: C.brown }}>{copied === label ? L('¡Copiado!', 'Copied!') : L('Copiar', 'Copy')}</Text>
    </Pressable>
  );

  return (
    <Screen wall="send">
      <BackBar steps={[d.kind === 'send' ? L('Envío', 'Transfer') : d.kind === 'shop' ? L('Carrito', 'Cart') : L('Servicio', 'Service'), L('Pago', 'Payment'), L('Listo', 'Done')]} cur={1} />
      <H1>{L('Paga y sube tu captura', 'Pay and upload your screenshot')}</H1>

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
        <Label>1 · {L('Envía el pago por Zelle desde la app de tu banco', 'Send the payment with Zelle from your bank app')}</Label>
        <CopyRow label={L('Zelle de la tienda', 'Store Zelle')} value={st.zelle_dato || '—'} />
        <CopyRow label={L('Monto exacto', 'Exact amount')} value={total.toFixed(2)} />
        <CopyRow label={L('Escribe en la nota', 'Write in the memo')} value={memo} />
        <P small muted>{L(`En Zelle debe aparecer como "${st.zelle_nombre}".`, `In Zelle it should show as "${st.zelle_nombre}".`)}</P>
      </Card>

      <Card>
        <Label>2 · {L('Sube la captura de tu pago', 'Upload your payment screenshot')}</Label>
        <Pressable
          accessibilityRole="button"
          onPress={async () => setShot((await pickImage()) || shot)}
          style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, borderRadius: R.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          {shot ? <Image source={{ uri: shot.uri }} style={{ width: 72, height: 96, borderRadius: 10 }} /> : <IcoBox n="upload" size={48} />}
          <Text style={{ fontWeight: '800', color: C.ink, flex: 1 }}>{shot ? L('Cambiar captura', 'Change screenshot') : L('Elegir captura', 'Choose screenshot')}</Text>
        </Pressable>
        <Field label={L('Nombre con el que pagaste en Zelle', 'Name you paid with on Zelle')} value={zelleName} onChangeText={setZelleName} hint={L('Así la tienda encuentra tu pago más rápido.', 'This helps the store find your payment faster.')} />
      </Card>

      {err ? <Note kind="red">{err}</Note> : null}
      <Btn title={L('Ya pagué, enviar a la tienda', 'I paid, send to the store')} onPress={submit} loading={busy} disabled={!shot} icon="check" />
      <Note kind="blue" icon="shield">{L('La tienda revisa tu pago, hace tu trámite y te manda el comprobante aquí mismo.', 'The store checks your payment, does your service and sends the receipt right here.')}</Note>
    </Screen>
  );
}
