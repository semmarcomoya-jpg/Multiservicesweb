import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { Scene } from '@/components/scenes';
import { BackBar, Btn, Card, Empty, H1, IcoBox, Icon, Loading, Note, P, Pills, Row, Screen, TopBar, SearchBox, matches } from '@/components/ui';
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

  const steps = [L('Monto', 'Amount'), L('Quién recibe', 'Recipient'), L('Cómo recibe', 'Delivery'), L('Pagar', 'Pay')];
  const go = (n: number) => { setTried(false); setStep(n); };
  const key = (k: string) =>
    setMonto((m) => {
      if (k === '⌫') return m.slice(0, -1);
      if (k === '.' && m.includes('.')) return m;
      const v = (m === '0' && k !== '.' ? '' : m) + k;
      if (/\.\d{3}$/.test(v) || v.replace('.', '').length > 6) return m;
      return v;
    });
  const recv = cur(amt * rate, pc.cur);
  const ptsGain = (() => {
    const st = sendStores.find((x) => x.id === storeId);
    const ly = st?.loyalty;
    return ly?.on ? Math.round((Number(ly.perTx) || 0) + (amt / 100) * (Number(ly.per100) || 0)) : 0;
  })();
  const shell = (n: number, body: React.ReactNode, footer: React.ReactNode) => (
    <Screen wall="send" footer={footer}>
      <BackBar steps={steps} cur={n - 1} />
      {body}
    </Screen>
  );

  // 1 · Monto con teclado grande y conversión en vivo
  if (step === 1)
    return shell(
      1,
      <>
        <Card style={{ alignItems: 'stretch', gap: 10 }}>
          <Text style={{ textAlign: 'center', fontWeight: '800', color: C.muted }}>{L('¿Cuánto mandas?', 'How much are you sending?')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
            <Text accessibilityLabel={L('Monto en dólares', 'Amount in dollars')} style={{ fontSize: 46, fontWeight: '900', color: C.ink, letterSpacing: -1 }}>${monto || '0'}</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.muted }}>USD</Text>
          </View>
          <View style={{ backgroundColor: '#DDF1E4', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '900', color: '#1E7A4A' }}>{L('Recibe', 'They receive')} {co.flag}</Text>
            <Text style={{ fontWeight: '900', color: '#1E7A4A' }}>{recv}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {QUICK.map((v) => (
              <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: monto === v }} onPress={() => setMonto(v)}
                style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: monto === v ? '#0B2E5E' : C.line, backgroundColor: monto === v ? '#0B2E5E' : C.card }}>
                <Text style={{ fontWeight: '900', color: monto === v ? '#fff' : C.ink }}>${v}</Text>
              </Pressable>
            ))}
          </View>
          <P small muted style={{ textAlign: 'center' }}>{`1 USD = ${rate.toFixed(2)} ${pc.cur} · ${L('comisión', 'fee')} ${money(fee)} · ${L('hasta', 'up to')} ${money(limit)}`}</P>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === '⌫' ? L('Borrar', 'Delete') : k} onPress={() => key(k)}
              style={({ pressed }) => ({ width: '32%', flexGrow: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.tint : C.card })}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        {tried && errs.monto ? <Note kind="red">{errs.monto}</Note> : null}
        {profile?.id_status !== 'verificada' ? (
          <P small muted style={{ textAlign: 'center' }}>
            <Text onPress={() => router.push('/identidad')} style={{ color: C.blue, fontWeight: '800', textDecorationLine: 'underline' }}>{L('Verifica tu identidad para mandar más', 'Verify your ID to send more')}</Text>
          </P>
        ) : null}
      </>,
      <Btn title={amt < 10 ? L('Escribe al menos $10', 'Enter at least $10') : L('Siguiente', 'Next')} disabled={amt < 10} onPress={() => { setTried(true); if (!errs.monto) go(2); }} />,
    );

  // 2 · Quién recibe
  if (step === 2)
    return shell(
      2,
      <>
        {last && lastB ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { setSel(lastB.id); setMonto(String(Number(last.monto))); go(4); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: '#DDF1E4', opacity: pressed ? 0.85 : 1 })}
          >
            <IcoBox n="repeat" size={40} bg="#fff" color="#1E5B35" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#1E5B35' }}>{L('Repetir el último envío', 'Repeat last transfer')}</Text>
              <P small style={{ color: '#1E5B35' }}>{`${lastB.nombre} ${lastB.apellidos}`.trim()} · {money(last.monto)}</P>
            </View>
          </Pressable>
        ) : null}
        {benefs.length > 4 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca a la persona', 'Search the person')} /> : null}
        {benefs.length === 0 ? <Empty>{L('Agrega a la persona que recibe el dinero.', 'Add the person who receives the money.')}</Empty> : null}
        {benefs.filter((x) => x.id === sel || matches(q, x.nombre, x.apellidos, x.parentesco, x.ciudad, x.banco, x.red)).map((x) => {
          const c = countryOf(x.pais);
          const on = sel === x.id;
          const ini = `${x.nombre[0] || ''}${x.apellidos[0] || ''}`.toUpperCase();
          return (
            <Pressable key={x.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSel(x.id)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: on ? 10.5 : 11, borderRadius: 16, borderWidth: on ? 2 : 1.5, borderColor: on ? C.brown : C.line, backgroundColor: on ? C.tint : C.card }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900' }}>{ini}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.ink }}>{`${x.nombre} ${x.apellidos}`.trim()}</Text>
                <P small muted>{c.flag} {[x.parentesco, x.ciudad].filter(Boolean).join(' · ')} · {x.metodo === 'cuenta' ? `${x.banco} ···${x.cuenta.slice(-4)}` : L('Retiro en ', 'Pickup at ') + x.red}</P>
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.brown : C.line2, backgroundColor: on ? C.brown : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon n="check" size={13} color="#fff" sw={3.4} /> : null}</View>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={() => router.push('/beneficiarios/nuevo')}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 11, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card }}>
          <IcoBox n="plus" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>{L('Agregar persona', 'Add a person')}</Text>
            <P small muted>{L('Nombre como en su identificación', 'Name as on their ID')}</P>
          </View>
        </Pressable>
        {tried && errs.b ? <Note kind="red">{errs.b}</Note> : null}
      </>,
      <Row style={{ flexWrap: 'nowrap' }}>
        <Btn kind="ghost" title={L('Atrás', 'Back')} onPress={() => go(1)} />
        <Btn title={L('Siguiente', 'Next')} style={{ flex: 1 }} onPress={() => { setTried(true); if (!errs.b) go(3); }} />
      </Row>,
    );

  // 3 · Cómo recibe
  if (step === 3)
    return shell(
      3,
      <>
        {b ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10.5, borderRadius: 16, borderWidth: 2, borderColor: C.brown, backgroundColor: C.tint }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}><Scene n={b.metodo === 'cuenta' ? 'envio' : 'tramite'} size={40} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.ink }}>{b.metodo === 'cuenta' ? L('Depósito a cuenta', 'Bank deposit') : L('Retiro en efectivo', 'Cash pickup')}</Text>
              <P small muted>{b.metodo === 'cuenta' ? `${b.banco} ···${b.cuenta.slice(-4)}` : `${b.red} · ${L('con su identificación', 'with their ID')}`}</P>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}><Icon n="check" size={13} color="#fff" sw={3.4} /></View>
          </View>
        ) : null}
        <P small muted>{L(`Así lo recibe ${b?.nombre || ''}. Para cambiarlo, edita sus datos en Mis personas.`, `This is how ${b?.nombre || ''} receives it. To change it, edit them in My people.`)}</P>
        {sendStores.length > 1 ? (
          <Card>
            <Pills label={L('¿Qué tienda hace tu envío?', 'Which store handles your transfer?')} options={storeOptions(sendStores, L('Cerrada', 'Closed'), scores)} value={storeId} onChange={setStoreId} />
            {tried && errs.store ? <Note kind="red">{errs.store}</Note> : null}
          </Card>
        ) : tried && errs.store ? <Note kind="red">{errs.store}</Note> : null}
        <Card style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon n="shield" size={16} color={C.muted} />
          <P small muted style={{ flex: 1 }}>{L(`Hasta ${money(num(cfg.limit_l1))} sin identificación. Con tu ID verificada puedes mandar hasta ${money(num(cfg.limit_l2))}.`, `Up to ${money(num(cfg.limit_l1))} without ID. With a verified ID you can send up to ${money(num(cfg.limit_l2))}.`)}</P>
        </Card>
      </>,
      <Row style={{ flexWrap: 'nowrap' }}>
        <Btn kind="ghost" title={L('Atrás', 'Back')} onPress={() => go(2)} />
        <Btn title={L('Siguiente', 'Next')} style={{ flex: 1 }} onPress={() => { setTried(true); if (!errs.store) go(4); }} />
      </Row>,
    );

  // 4 · Pagar
  return shell(
    4,
    <>
      <Card style={{ gap: 8 }}>
        {[
          [L('Envías', 'You send'), money(amt)],
          [L('Comisión', 'Fee'), money(fee)],
          [`${b ? b.nombre : ''} ${L('recibe', 'receives')}`, recv],
        ].map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: C.ink }}>{k}</Text>
            <Text style={{ fontWeight: '800', color: C.ink }}>{v}</Text>
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{L('Total a pagar', 'Total to pay')}</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{money(amt + fee)}</Text>
        </Row>
      </Card>
      <P small muted>{L('En el siguiente paso ves a dónde mandar tu Zelle. El tipo de cambio queda fijo al mandar tu pedido.', 'Next you will see where to send your Zelle. The rate is locked when you send your order.')}</P>
      {ptsGain > 0 ? (
        <Row gap={6}>
          <Icon n="gift" size={18} color={C.goldInk} />
          <Text style={{ fontWeight: '800', fontSize: 13, color: C.goldInk }}>{L(`Ganas +${ptsGain} puntos con este envío`, `You earn +${ptsGain} points with this transfer`)}</Text>
        </Row>
      ) : null}
      {tried && (errs.b || errs.monto || errs.store) ? <Note kind="red">{errs.b || errs.monto || errs.store}</Note> : null}
    </>,
    <Row style={{ flexWrap: 'nowrap' }}>
      <Btn kind="ghost" title={L('Atrás', 'Back')} onPress={() => go(3)} />
      <Btn title={L('Pagar con Zelle', 'Pay with Zelle')} icon="arrow" style={{ flex: 1 }} onPress={next} />
    </Row>,
  );
}
