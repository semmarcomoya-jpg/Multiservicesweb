import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackBar, Btn, Card, Empty, Field, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { cartTotal, setQty, useCart } from '@/lib/cart';
import { homeFee, modesFor, useStores } from '@/lib/data';
import { setDraft } from '@/lib/draft';
import { digits, money, splitList } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Mode } from '@/lib/types';

const MODE_ICON: Record<string, string> = { store: 'store', curb: 'car', home: 'truck' };

export default function Carrito() {
  const { L } = useLang();
  const cart = useCart();
  const { data: stores } = useStores();
  const st = (stores || []).find((x) => x.id === cart.storeId) || null;
  const modes = modesFor(st, ['store', 'curb', 'home']);
  const [mode, setMode] = useState<Mode | null>(null);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (modes.length && (!mode || !modes.includes(mode))) setMode(modes[0]);
  }, [modes.join(','), mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stores) return <Loading />;
  if (!cart.items.length || !st) {
    return (
      <Screen>
        <BackBar title={L('Carrito', 'Cart')} />
        <Empty>{L('Tu carrito está vacío.', 'Your cart is empty.')}</Empty>
        <Btn title={L('Ver productos', 'See products')} onPress={() => router.replace('/productos')} />
      </Screen>
    );
  }

  const sub = cartTotal(cart);
  const fee = mode === 'home' ? homeFee(st, sub) : 0;
  const slots = splitList(st.delivery?.slots);
  const errs: Record<string, string> = {};
  if (st.abierta === false) errs.closed = st.aviso_cerrada || L('La tienda está cerrada en este momento.', 'The store is closed right now.');
  if (!mode) errs.mode = L('La tienda no tiene formas de entrega activas.', 'The store has no delivery options enabled.');
  if ((mode === 'store' || mode === 'curb') && slots.length && !time) errs.time = L('Elige un horario', 'Pick a time');
  if (mode === 'home' && !address.trim()) errs.addr = L('Escribe la dirección', 'Enter the address');
  if (mode === 'home' && digits(zip).length !== 5) errs.zip = L('Código postal de 5 dígitos', '5-digit ZIP code');
  if (mode === 'home' && st.delivery?.zips && digits(zip).length === 5 && !splitList(st.delivery.zips).includes(digits(zip))) errs.zip = L('La tienda no entrega en ese código postal', "The store doesn't deliver to that ZIP");
  const ok = Object.keys(errs).length === 0;

  const next = () => {
    setTried(true);
    if (!ok || !mode) return;
    setDraft({ kind: 'shop', storeId: st.id, items: cart.items, subtotal: sub, fee, entrega: { mode, time: time || undefined, address: address.trim() || undefined, zip: digits(zip) || undefined } });
    router.push('/pago');
  };

  const modeTxt: Record<string, [string, string]> = {
    store: [L('Recoger en tienda', 'Pick up in store'), L('Elige la hora y pasas por él', 'Pick a time and come by')],
    curb: [L('Sin bajar del carro', 'Curbside'), L('Avísanos al llegar y te lo llevamos', 'Tell us when you arrive and we bring it out')],
    home: [L('A domicilio', 'Home delivery'), homeFee(st, sub) > 0 ? L(`Cargo de ${money(homeFee(st, sub))}`, `${money(homeFee(st, sub))} fee`) : L('Envío gratis', 'Free delivery')],
  };

  return (
    <Screen
      footer={
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View>
            <P small muted>{L('Total a pagar', 'Total to pay')}</P>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(sub + fee)}</Text>
          </View>
          <Btn title={L('Continuar al pago', 'Continue to payment')} icon="arrow" onPress={next} />
        </Row>
      }
    >
      <BackBar title={L('Carrito', 'Cart')} />
      <H1>{L('Tu compra', 'Your purchase')}</H1>
      <P muted>{st.nombre}</P>
      {errs.closed ? <Note kind="red" icon="clock">{errs.closed}</Note> : null}
      <Card>
        {cart.items.map((x) => (
          <Row key={x.variant_id} style={{ flexWrap: 'nowrap' }} gap={10}>
            <IcoBox n="bag" size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.ink }}>{x.name}</Text>
              <P small muted>{x.label} · {money(x.price)}</P>
            </View>
            <Row gap={6} style={{ flexWrap: 'nowrap' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={L('Menos', 'Less')} onPress={() => setQty(x.variant_id, x.qty - 1)} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '900', fontSize: 18 }}>−</Text>
              </Pressable>
              <Text style={{ fontWeight: '900', minWidth: 22, textAlign: 'center' }}>{x.qty}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={L('Más', 'More')} onPress={() => setQty(x.variant_id, Math.min(20, x.qty + 1))} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '900', fontSize: 18 }}>+</Text>
              </Pressable>
            </Row>
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
          <P>{L('Subtotal', 'Subtotal')}</P>
          <Text style={{ fontWeight: '900', color: C.ink }}>{money(sub)}</Text>
        </Row>
      </Card>
      <Card>
        <Label>{L('¿Cómo lo quieres?', 'How do you want it?')}</Label>
        {modes.map((m) => (
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => setMode(m)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: mode === m ? C.brown : C.line, backgroundColor: mode === m ? C.tint : C.card }}>
            <IcoBox n={MODE_ICON[m]} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.ink }}>{modeTxt[m][0]}</Text>
              <P small muted>{modeTxt[m][1]}</P>
            </View>
          </Pressable>
        ))}
        {tried && errs.mode ? <Note kind="red">{errs.mode}</Note> : null}
        {(mode === 'store' || mode === 'curb') && slots.length ? (
          <View style={{ gap: 4 }}>
            <Pills label={L('¿A qué hora pasas?', 'What time will you come?')} options={slots.map((x) => ({ v: x, label: x, icon: 'clock' }))} value={time} onChange={setTime} />
            {tried && errs.time ? <Text style={{ color: C.red, fontWeight: '700' }}>{errs.time}</Text> : null}
          </View>
        ) : null}
        {mode === 'home' ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={L('Dirección', 'Address')} value={address} onChangeText={setAddress} error={tried ? errs.addr : ''} style={{ minWidth: 240 }} />
            <Field label={L('Código postal', 'ZIP code')} value={zip} onChangeText={(v) => setZip(digits(v))} keyboardType="number-pad" maxLength={5} error={tried ? errs.zip : ''} style={{ minWidth: 110, maxWidth: 160 }} />
          </Row>
        ) : null}
        <Note kind="blue" icon="shield">{L('Te daremos un código de 4 dígitos. Solo entregamos tu pedido a quien diga ese código.', "You'll get a 4-digit code. We only hand over your order to whoever says that code.")}</Note>
      </Card>
    </Screen>
  );
}
