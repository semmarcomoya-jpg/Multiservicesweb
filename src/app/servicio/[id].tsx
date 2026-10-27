import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { BackBar, Btn, Card, Field, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { homeFee, modesFor, storesForService, svcCatIcon, useCategories, useServices, useStores } from '@/lib/data';
import { setDraft } from '@/lib/draft';
import { digits, money, num, splitList } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Mode, OrderDataItem } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';
import { errMsg } from '@/lib/supabase';

const MODE_ICON: Record<Mode, string> = { digital: 'home', store: 'store', curb: 'car', home: 'truck' };

export default function ServicioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { L, nm, lang } = useLang();
  const { session, profile } = useAuth();
  const { data: services } = useServices();
  const { data: stores } = useStores();
  const { data: cats } = useCategories();
  const sv = (services || []).find((x) => x.id === id);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [opt, setOpt] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode | null>(null);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [tried, setTried] = useState(false);
  const [uploading, setUploading] = useState('');
  const [upErr, setUpErr] = useState('');

  const avail = useMemo(() => (sv && stores ? storesForService(stores, sv) : []), [sv, stores]);
  useEffect(() => {
    if (!storeId && avail.length) {
      const fav = avail.find((x) => x.id === profile?.store_id);
      setStoreId((fav || avail[0]).id);
    }
  }, [avail, storeId, profile]);
  const st = avail.find((x) => x.id === storeId) || null;
  const modes = sv ? modesFor(st, sv.modes) : [];
  useEffect(() => {
    if (modes.length && (!mode || !modes.includes(mode))) setMode(modes[0]);
  }, [modes.join(','), mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sv || !stores) return <Loading />;

  const base = sv.price_type === 'fixed' ? num(sv.base) : sv.price_type === 'options' ? (opt === null ? 0 : num(sv.options[opt]?.p)) : num(amount);
  const fee = num(sv.fee) + (mode === 'home' ? homeFee(st, base) : 0);
  const slots = splitList(st?.delivery?.slots);

  const errs: Record<string, string> = {};
  if (base <= 0) errs._price = sv.price_type === 'options' ? L('Elige una opción', 'Choose an option') : L('Escribe el monto', 'Enter the amount');
  for (const f of sv.fields || []) {
    const v = (vals[f.k] || '').trim();
    if (!v && !f.optional) errs[f.k] = f.type === 'photo' ? L('Sube la foto', 'Upload the photo') : f.type === 'select' ? L('Elige una opción', 'Choose one') : L('Este dato es necesario', 'This is required');
    else if (v && f.type === 'tel' && f.digits && digits(v).length !== Number(f.digits)) errs[f.k] = L(`Debe tener ${f.digits} dígitos`, `Must be ${f.digits} digits`);
  }
  if (!mode) errs._mode = L('Esta tienda no tiene formas de entrega para este servicio', 'This store has no delivery options for this service');
  if ((mode === 'store' || mode === 'curb') && slots.length && !time) errs._time = L('Elige un horario', 'Pick a time');
  if (mode === 'home' && !address.trim()) errs._addr = L('Escribe la dirección', 'Enter the address');
  if (mode === 'home' && digits(zip).length !== 5) errs._zip = L('Código postal de 5 dígitos', '5-digit ZIP code');
  if (mode === 'home' && st?.delivery?.zips && digits(zip).length === 5 && !splitList(st.delivery.zips).includes(digits(zip)))
    errs._zip = L('La tienda no entrega en ese código postal', "The store doesn't deliver to that ZIP");
  const ok = Object.keys(errs).length === 0;
  const e = (k: string) => (tried ? errs[k] : '');

  const upload = async (k: string) => {
    if (!session) return;
    setUpErr('');
    const img = await pickImage();
    if (!img) return;
    try {
      setUploading(k);
      const path = await uploadImage('capturas', session.user.id, img);
      setVals((p) => ({ ...p, [k]: path, ['__preview_' + k]: img.uri }));
    } catch (er) {
      setUpErr(errMsg(er));
    } finally {
      setUploading('');
    }
  };

  const next = () => {
    setTried(true);
    if (!ok || !st || !mode) return;
    const data: OrderDataItem[] = (sv.fields || []).map((f) => ({ k: f.k, es: f.es, en: f.en, type: f.type, value: (vals[f.k] || '').trim() }));
    setDraft({
      kind: 'service',
      storeId: st.id,
      serviceId: sv.id,
      serviceName: { es: sv.es, en: sv.en },
      icon: svcCatIcon(cats || [], sv),
      option: sv.price_type === 'options' ? opt : null,
      optionLabel: sv.price_type === 'options' && opt !== null ? nm(sv.options[opt]) : '',
      amount: sv.price_type === 'amount' ? num(amount) : null,
      base,
      fee,
      data,
      entrega: { mode, time: time || undefined, address: address.trim() || undefined, zip: digits(zip) || undefined },
    });
    router.push('/pago');
  };

  const modeTxt: Record<Mode, [string, string]> = {
    digital: [L('Sin salir de casa', 'From home'), L('Lo hacemos y te mandamos el comprobante', 'We do it and send you the receipt')],
    store: [L('Recoger en tienda', 'Pick up in store'), L('Elige la hora y pasas por él', 'Pick a time and come by')],
    curb: [L('Sin bajar del carro', 'Curbside'), L('Avísanos al llegar y te lo llevamos', 'Tell us when you arrive and we bring it out')],
    home: [L('A domicilio', 'Home delivery'), st?.delivery ? L(`Cargo de ${money(homeFee(st, base))}`, `${money(homeFee(st, base))} fee`) : ''],
  };

  return (
    <Screen
      footer={
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View>
            <P small muted>{L('Total a pagar', 'Total to pay')}</P>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(base > 0 ? base + fee : 0)}</Text>
          </View>
          <Btn title={L('Continuar al pago', 'Continue to payment')} onPress={next} icon="arrow" />
        </Row>
      }
    >
      <BackBar />
      <Row gap={12} style={{ flexWrap: 'nowrap' }}>
        <IcoBox n={svcCatIcon(cats || [], sv)} size={52} />
        <View style={{ flex: 1 }}>
          <H1>{nm(sv)}</H1>
          <P muted>{lang === 'es' ? sv.desc_es : sv.desc_en}</P>
        </View>
      </Row>
      {avail.length === 0 ? <Note kind="red">{L('Ninguna tienda ofrece este servicio por ahora.', 'No store offers this service right now.')}</Note> : null}

      <Card>
        <Pills label={L('¿En qué tienda?', 'Which store?')} options={avail.map((x) => ({ v: x.id, label: x.nombre.replace('Castillo · ', ''), icon: 'store' }))} value={storeId} onChange={setStoreId} />
      </Card>

      <Card>
        <Label>{L('¿Cuánto?', 'How much?')}</Label>
        {sv.price_type === 'fixed' ? <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{money(sv.base)}</Text> : null}
        {sv.price_type === 'options' ? (
          <Pills options={(sv.options || []).map((o, i) => ({ v: i, label: `${nm(o)} · ${money(o.p)}` }))} value={opt} onChange={setOpt} />
        ) : null}
        {sv.price_type === 'amount' ? (
          <>
            {(sv.amounts || []).length ? (
              <Pills options={sv.amounts.map((a) => ({ v: String(a), label: money(a) }))} value={amount} onChange={setAmount} />
            ) : null}
            <Field label={L('Monto en USD', 'Amount in USD')} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          </>
        ) : null}
        {e('_price') ? <Text style={{ color: C.red, fontWeight: '700' }}>{e('_price')}</Text> : null}
        {num(sv.fee) > 0 ? <P small muted>{L('Comisión del servicio: ', 'Service fee: ') + money(sv.fee)}</P> : null}
      </Card>

      {(sv.fields || []).length ? (
        <Card>
          <Label>{L('Datos para hacer tu servicio', 'Details for your service')}</Label>
          {sv.fields.map((f) =>
            f.type === 'select' ? (
              <View key={f.k} style={{ gap: 4 }}>
                <Pills label={nm(f) + (f.optional ? L(' (opcional)', ' (optional)') : '')} options={splitList(f.opts).map((o) => ({ v: o, label: o }))} value={vals[f.k]} onChange={(v) => setVals((p) => ({ ...p, [f.k]: v }))} />
                {e(f.k) ? <Text style={{ color: C.red, fontWeight: '700' }}>{e(f.k)}</Text> : null}
              </View>
            ) : f.type === 'photo' ? (
              <View key={f.k} style={{ gap: 6 }}>
                <Label>{nm(f)}</Label>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => upload(f.k)}
                  style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: e(f.k) ? C.red : C.line2, borderRadius: R.md, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}
                >
                  {vals['__preview_' + f.k] ? (
                    <Image source={{ uri: vals['__preview_' + f.k] }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                  ) : (
                    <IcoBox n="camera" size={44} />
                  )}
                  <Text style={{ fontWeight: '800', color: C.ink, flex: 1 }}>
                    {uploading === f.k ? L('Subiendo…', 'Uploading…') : vals[f.k] ? L('Cambiar foto', 'Change photo') : L('Subir foto', 'Upload photo')}
                  </Text>
                </Pressable>
                {e(f.k) ? <Text style={{ color: C.red, fontWeight: '700' }}>{e(f.k)}</Text> : null}
              </View>
            ) : (
              <Field
                key={f.k}
                label={nm(f) + (f.optional ? L(' (opcional)', ' (optional)') : '')}
                value={vals[f.k] || ''}
                onChangeText={(v) => setVals((p) => ({ ...p, [f.k]: f.type === 'tel' ? digits(v) : v }))}
                keyboardType={f.type === 'tel' ? 'number-pad' : 'default'}
                maxLength={f.type === 'tel' && f.digits ? Number(f.digits) : undefined}
                error={e(f.k)}
              />
            ),
          )}
          {upErr ? <Note kind="red">{upErr}</Note> : null}
        </Card>
      ) : null}

      <Card>
        <Label>{L('¿Cómo lo quieres?', 'How do you want it?')}</Label>
        {modes.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === m }}
            onPress={() => setMode(m)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: mode === m ? C.brown : C.line, backgroundColor: mode === m ? C.tint : C.card }}
          >
            <IcoBox n={MODE_ICON[m]} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.ink }}>{modeTxt[m][0]}</Text>
              <P small muted>{modeTxt[m][1]}</P>
            </View>
          </Pressable>
        ))}
        {e('_mode') ? <Note kind="red">{e('_mode')}</Note> : null}
        {(mode === 'store' || mode === 'curb') && slots.length ? (
          <View style={{ gap: 4 }}>
            <Pills label={L('¿A qué hora pasas?', 'What time will you come?')} options={slots.map((x) => ({ v: x, label: x, icon: 'clock' }))} value={time} onChange={setTime} />
            {e('_time') ? <Text style={{ color: C.red, fontWeight: '700' }}>{e('_time')}</Text> : null}
          </View>
        ) : null}
        {mode === 'home' ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={L('Dirección', 'Address')} value={address} onChangeText={setAddress} error={e('_addr')} style={{ minWidth: 240 }} />
            <Field label={L('Código postal', 'ZIP code')} value={zip} onChangeText={(v) => setZip(digits(v))} keyboardType="number-pad" maxLength={5} error={e('_zip')} style={{ minWidth: 110, maxWidth: 160 }} />
          </Row>
        ) : null}
        {mode && mode !== 'digital' ? (
          <Note kind="blue" icon="shield">{L('Te daremos un código de 4 dígitos. Solo entregamos tu pedido a quien diga ese código.', "You'll get a 4-digit code. We only hand over your order to whoever says that code.")}</Note>
        ) : null}
      </Card>
    </Screen>
  );
}
