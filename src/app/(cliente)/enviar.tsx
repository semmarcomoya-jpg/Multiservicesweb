import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { BackBar, Btn, Card, Empty, Field, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen, TopBar, SearchBox, matches } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, pickOpen, storeOptions, useSettings, useStores } from '@/lib/data';
import { setDraft } from '@/lib/draft';
import { money, mxn, num } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Beneficiary } from '@/lib/types';

export default function Enviar() {
  const { L } = useLang();
  const { session, profile } = useAuth();
  const { data: cfg } = useSettings();
  const { data: stores } = useStores();
  const [benefs, setBenefs] = useState<Beneficiary[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [tried, setTried] = useState(false);
  const [q, setQ] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      supabase
        .from('beneficiaries')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setBenefs((data as Beneficiary[]) ?? []);
          if (data && data.length && !sel) setSel(data[0].id);
        });
    }, [session, sel]),
  );

  const sendStores = (stores || []).filter((st) => st.activo && modOn(st, 'send'));
  useEffect(() => {
    if (!storeId && sendStores.length) setStoreId(pickOpen(sendStores, profile?.store_id));
  }, [sendStores.length, storeId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg || !benefs) return <Loading />;

  const amt = num(monto);
  const limit = profile?.id_status === 'verificada' ? num(cfg.limit_l2) : num(cfg.limit_l1);
  const fee = num(cfg.send_fee);
  const rate = num(cfg.exchange_rate);
  const b = benefs.find((x) => x.id === sel);
  const errs = {
    b: b ? '' : L('Elige a quién le envías', 'Choose who you are sending to'),
    monto: amt <= 0 ? L('Escribe cuánto envías', 'Enter the amount') : amt > limit ? L(`Tu límite por envío es ${money(limit)}`, `Your limit per transfer is ${money(limit)}`) : '',
    store: !storeId ? L('Elige la tienda', 'Choose the store') : sendStores.find((x) => x.id === storeId)?.abierta === false ? L('Esa tienda está cerrada en este momento', 'That store is closed right now') : '',
  };
  const ok = !errs.b && !errs.monto && !errs.store;

  const next = () => {
    setTried(true);
    if (!ok || !b || !storeId) return;
    setDraft({ kind: 'send', storeId, beneficiaryId: b.id, beneficiaryName: `${b.nombre} ${b.apellidos}`.trim(), monto: amt, fee, rate, mxn: Math.round(amt * rate * 100) / 100 });
    router.push('/pago');
  };

  if (!sendStores.length) {
    return (
      <Screen wall="send">
        <TopBar />
        <H1>{L('Enviar dinero', 'Send money')}</H1>
        <Empty>{L('Por ahora ninguna tienda ofrece envíos.', 'No store offers transfers right now.')}</Empty>
      </Screen>
    );
  }

  return (
    <Screen
      wall="send"
      footer={
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View>
            <P small muted>{L('Pagas', 'You pay')}</P>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(amt > 0 ? amt + fee : 0)}</Text>
          </View>
          <Btn title={L('Continuar al pago', 'Continue to payment')} onPress={next} icon="arrow" />
        </Row>
      }
    >
      <BackBar steps={[L('Envío', 'Transfer'), L('Pago', 'Payment'), L('Listo', 'Done')]} cur={0} />
      <H1>{L('Enviar dinero a México', 'Send money to Mexico')}</H1>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{L('¿A quién le envías?', 'Who are you sending to?')}</Label>
          <Btn small kind="ghost" icon="users" title={L('Agregar', 'Add')} onPress={() => router.push('/beneficiarios/nuevo')} />
        </Row>
        {benefs.length === 0 ? <Empty>{L('Agrega a la persona que recibe el dinero.', 'Add the person who receives the money.')}</Empty> : null}
        {benefs.length > 4 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca a la persona', 'Search the person')} /> : null}
        {benefs.filter((x) => x.id === sel || matches(q, x.nombre, x.apellidos, x.parentesco, x.ciudad, x.banco, x.red)).map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel === x.id }}
            onPress={() => setSel(x.id)}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: sel === x.id ? C.brown : C.line, backgroundColor: sel === x.id ? C.tint : C.card }}
          >
            <IcoBox n={x.metodo === 'cuenta' ? 'bank' : 'cash'} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.ink }}>{`${x.nombre} ${x.apellidos}`.trim()}</Text>
              <P small muted>
                {x.parentesco ? x.parentesco + ' · ' : ''}
                {x.metodo === 'cuenta' ? `${x.banco} ···${x.cuenta.slice(-4)}` : L('Retiro en efectivo · ', 'Cash pickup · ') + x.red}
              </P>
            </View>
          </Pressable>
        ))}
        {tried && errs.b ? <Text style={{ color: C.red, fontWeight: '700' }}>{errs.b}</Text> : null}
      </Card>

      <Card>
        <Field label={L('¿Cuánto envías? (USD)', 'How much are you sending? (USD)')} value={monto} onChangeText={(v) => setMonto(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" error={tried ? errs.monto : ''} />
        <View style={{ backgroundColor: C.blueSoft, borderRadius: R.md, padding: 14, gap: 4 }}>
          <P small style={{ color: C.blueInk }}>{L('Recibe aproximadamente', 'They receive about')}</P>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.blueInk }}>{mxn(amt * rate)}</Text>
          <P small style={{ color: C.blueInk }}>
            1 USD = {rate.toFixed(2)} MXN · {L('Comisión ', 'Fee ')}
            {money(fee)}
          </P>
        </View>
        <P small muted>{L(`Puedes enviar hasta ${money(limit)} por envío.`, `You can send up to ${money(limit)} per transfer.`)}{profile?.id_status !== 'verificada' ? L(' Para enviar más, muestra tu identificación en la tienda.', ' To send more, show your ID at the store.') : ''}</P>
      </Card>

      <Card>
        <Pills label={L('¿Qué tienda hace tu envío?', 'Which store handles your transfer?')} options={storeOptions(sendStores, L('Cerrada', 'Closed'))} value={storeId} onChange={setStoreId} />
        {tried && errs.store ? <Note kind="red">{errs.store}</Note> : null}
        <P small muted>{L('Esa tienda recibe tu pago por Zelle y realiza tu envío.', 'That store receives your Zelle payment and makes your transfer.')}</P>
      </Card>
      <Note kind="gold" icon="shield">{L('El tipo de cambio queda fijo en el momento en que mandas tu pedido.', 'The rate is locked in when you send your order.')}</Note>
    </Screen>
  );
}
