import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { Scene } from '@/components/scenes';
import { BackBar, Btn, Card, Empty, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen, TopBar, SearchBox, matches } from '@/components/ui';
import { TextInput } from '@/components/Text';
import { useAuth } from '@/lib/auth';
import { countryOf, paisCfg } from '@/lib/countries';
import { modOn, pickOpen, storeOptions, useSettings, useStores, useStoreScores } from '@/lib/data';
import { setDraft } from '@/lib/draft';
import { cur, money, num } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Beneficiary, Order } from '@/lib/types';

const QUICK = ['100', '200', '300', '500'];

export default function Enviar() {
  const { L, lang } = useLang();
  const { session, profile } = useAuth();
  const { data: cfg } = useSettings();
  const { data: stores } = useStores();
  const { data: scores } = useStoreScores();
  const [benefs, setBenefs] = useState<Beneficiary[] | null>(null);
  const [last, setLast] = useState<Order | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [step, setStep] = useState(1);
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
      supabase
        .from('orders')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('kind', 'send')
        .neq('status', 'rechazado')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => setLast(((data as Order[]) ?? [])[0] || null));
    }, [session, sel]),
  );

  const sendStores = (stores || []).filter((st) => st.activo && modOn(st, 'send'));
  useEffect(() => {
    if (!storeId && sendStores.length) setStoreId(pickOpen(sendStores, profile?.store_id));
  }, [sendStores.length, storeId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg || !benefs) return <Loading />;

  const b = benefs.find((x) => x.id === sel);
  const pc = paisCfg(cfg, b?.pais);
  const co = countryOf(b?.pais);
  const amt = num(monto);
  const limit = profile?.id_status === 'verificada' ? num(cfg.limit_l2) : num(cfg.limit_l1);
  const fee = pc.fee;
  const rate = pc.rate;
  const lastB = last?.beneficiary ? benefs.find((x) => x.id === last.beneficiary?.id) : undefined;
  const errs = {
    b: !b ? L('Elige a quién le envías', 'Choose who you are sending to') : !pc.on || !rate ? L(`Por ahora no enviamos a ${co.es}`, `We do not send to ${co.en} yet`) : '',
    monto: amt <= 0 ? L('Escribe cuánto envías', 'Enter the amount') : amt < 10 ? L('El envío mínimo es de $10', 'Minimum is $10') : amt > limit ? L(`Tu límite por envío es ${money(limit)}`, `Your limit per transfer is ${money(limit)}`) : '',
    store: !storeId ? L('Elige la tienda', 'Choose the store') : sendStores.find((x) => x.id === storeId)?.abierta === false ? L('Esa tienda está cerrada en este momento', 'That store is closed right now') : '',
  };

  const next = () => {
    setTried(true);
    if (errs.b || errs.monto || errs.store || !b || !storeId) return;
    setDraft({ kind: 'send', storeId, beneficiaryId: b.id, beneficiaryName: `${b.nombre} ${b.apellidos}`.trim(), monto: amt, fee, rate, mxn: Math.round(amt * rate * 100) / 100, moneda: pc.cur, pais: pc.c });
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

  const steps = [L('Quién recibe', 'Recipient'), L('Monto', 'Amount'), L('Pago', 'Payment'), L('Listo', 'Done')];

  if (step === 1)
    return (
      <Screen
        wall="send"
        footer={<Btn title={L('Siguiente', 'Next')} icon="arrow" onPress={() => { setTried(true); if (!errs.b) { setTried(false); setStep(2); } }} />}
      >
        <BackBar steps={steps} cur={0} />
        <H1>{L('¿A quién le envías?', 'Who are you sending to?')}</H1>
        {last && lastB ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { setSel(lastB.id); setMonto(String(Number(last.monto))); setTried(false); setStep(2); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.lg, backgroundColor: '#DDF1E4', opacity: pressed ? 0.85 : 1 })}
          >
            <IcoBox n="repeat" size={40} bg="#fff" color="#1E5B35" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: '#1E5B35' }}>{L('Repetir el último envío', 'Repeat last transfer')}</Text>
              <P small style={{ color: '#1E5B35' }}>{`${lastB.nombre} ${lastB.apellidos}`.trim()} · {money(last.monto)}</P>
            </View>
          </Pressable>
        ) : null}
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>{L('Tus personas', 'Your people')}</Label>
            <Btn small kind="ghost" icon="users" title={L('Agregar', 'Add')} onPress={() => router.push('/beneficiarios/nuevo')} />
          </Row>
          {benefs.length === 0 ? <Empty>{L('Agrega a la persona que recibe el dinero.', 'Add the person who receives the money.')}</Empty> : null}
          {benefs.length > 4 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca a la persona', 'Search the person')} /> : null}
          {benefs.filter((x) => x.id === sel || matches(q, x.nombre, x.apellidos, x.parentesco, x.ciudad, x.banco, x.red)).map((x) => {
            const c = countryOf(x.pais);
            return (
              <Pressable
                key={x.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel === x.id }}
                onPress={() => setSel(x.id)}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: R.md, borderWidth: sel === x.id ? 2 : 1.5, borderColor: sel === x.id ? C.brown : C.line, backgroundColor: sel === x.id ? C.tint : C.card }}
              >
                <IcoBox n={x.metodo === 'cuenta' ? 'bank' : 'cash'} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '900', color: C.ink }}>{`${x.nombre} ${x.apellidos}`.trim()}</Text>
                  <P small muted>
                    {c.flag} {lang === 'es' ? c.es : c.en}{x.parentesco ? ' · ' + x.parentesco : ''} · {x.metodo === 'cuenta' ? `${x.banco} ···${x.cuenta.slice(-4)}` : L('Retiro en ', 'Pickup at ') + x.red}
                  </P>
                </View>
              </Pressable>
            );
          })}
          {tried && errs.b ? <Text style={{ color: C.red, fontWeight: '700' }}>{errs.b}</Text> : null}
        </Card>
      </Screen>
    );

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
      <BackBar steps={steps} cur={1} />
      <Pressable accessibilityRole="button" onPress={() => setStep(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: C.tint }}><Scene n="envio" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', color: C.ink, fontSize: 17 }}>{b ? `${b.nombre} ${b.apellidos}`.trim() : ''}</Text>
          <P small muted>{co.flag} {lang === 'es' ? co.es : co.en} · {L('Cambiar', 'Change')}</P>
        </View>
      </Pressable>
      <Card style={{ alignItems: 'stretch' }}>
        <Label>{L('¿Cuánto envías?', 'How much are you sending?')}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
          <Text style={{ fontSize: 40, fontWeight: '900', color: C.ink }}>$</Text>
          <TextInput
            accessibilityLabel={L('Monto en dólares', 'Amount in dollars')}
            value={monto}
            onChangeText={(v) => setMonto(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#93A5BD"
            style={{ fontSize: 44, fontWeight: '900', color: C.ink, minWidth: 90, maxWidth: 220, textAlign: 'center', paddingVertical: 4 }}
          />
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.muted }}>USD</Text>
        </View>
        <Row gap={8} style={{ justifyContent: 'center' }}>
          {QUICK.map((v) => (
            <Pressable key={v} accessibilityRole="button" onPress={() => setMonto(v)}
              style={{ paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: monto === v ? C.brownDark : C.line2, backgroundColor: monto === v ? C.brownDark : C.card }}>
              <Text style={{ fontWeight: '900', color: monto === v ? '#fff' : C.ink }}>${v}</Text>
            </Pressable>
          ))}
        </Row>
        <View style={{ backgroundColor: '#DDF1E4', borderRadius: R.md, padding: 14, gap: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <P small style={{ color: '#1E5B35', fontWeight: '800' }}>{L('Recibe', 'They receive')}</P>
            <P small style={{ color: '#1E5B35' }}>1 USD = {rate.toFixed(2)} {pc.cur}</P>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E5B35' }}>{cur(amt * rate, pc.cur)}</Text>
        </View>
        <P small muted>
          {L('Comisión ', 'Fee ') + money(fee)} · {L(`hasta ${money(limit)} por envío.`, `up to ${money(limit)} per transfer.`)}
          {profile?.id_status !== 'verificada' ? ' ' : ''}
          {profile?.id_status !== 'verificada' ? <Text onPress={() => router.push('/identidad')} style={{ color: C.blue, fontWeight: '800', textDecorationLine: 'underline' }}>{L('Verifica tu identidad para mandar más', 'Verify your ID to send more')}</Text> : null}
        </P>
        {tried && errs.monto ? <Note kind="red">{errs.monto}</Note> : null}
      </Card>

      {sendStores.length > 1 ? (
        <Card>
          <Pills label={L('¿Qué tienda hace tu envío?', 'Which store handles your transfer?')} options={storeOptions(sendStores, L('Cerrada', 'Closed'), scores)} value={storeId} onChange={setStoreId} />
          {tried && errs.store ? <Note kind="red">{errs.store}</Note> : null}
          <P small muted>{L('Esa tienda recibe tu pago por Zelle y realiza tu envío.', 'That store receives your Zelle payment and makes your transfer.')}</P>
        </Card>
      ) : tried && errs.store ? <Note kind="red">{errs.store}</Note> : null}
      <Note kind="gold" icon="shield">{L('El tipo de cambio queda fijo en el momento en que mandas tu pedido.', 'The rate is locked in when you send your order.')}</Note>
    </Screen>
  );
}
