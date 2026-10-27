import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BackBar, Btn, Card, Field, H2, Icon, Label, Loading, Note, P, Pills, Row, Screen, Toggle } from '@/components/ui';
import { useCategories, useServices } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { ICON_CHOICES } from '@/lib/icons';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { FieldType, Mode, Service, ServiceField } from '@/lib/types';

const blank = (cat: string): Service => ({
  id: '', cat_id: cat, es: '', en: '', desc_es: '', desc_en: '', icon: 'tool', price_type: 'fixed', base: 10, amounts: [], options: [], fee: 0,
  fields: [], modes: ['store'], eta_es: '', eta_en: '', points: true, activo: false, orden: 99,
});

export default function AdminServicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { L, nm } = useLang();
  const { data: services } = useServices();
  const { data: cats } = useCategories();
  const [f, setF] = useState<Service | null>(null);
  const [amounts, setAmounts] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!services || !cats || f) return;
    const sv = id === 'nuevo' ? blank(cats[0]?.id || 'rec') : services.find((x) => x.id === id);
    if (sv) {
      setF({ ...sv, options: sv.options || [], fields: sv.fields || [] });
      setAmounts((sv.amounts || []).join(', '));
    }
  }, [services, cats, id, f]);

  if (!f || !cats) return <Loading />;
  const set = <K extends keyof Service>(k: K, v: Service[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const setField = (i: number, patch: Partial<ServiceField>) => set('fields', f.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setOpt = (i: number, patch: Record<string, string>) => set('options', f.options.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setErr('');
    if (!f.es.trim() || !f.en.trim()) {
      setErr(L('Escribe el nombre en español y en inglés.', 'Enter the name in Spanish and English.'));
      return;
    }
    setBusy(true);
    const { id: _id, ...rest } = f;
    const payload = {
      ...rest,
      base: Number(f.base) || 0,
      fee: Number(f.fee) || 0,
      amounts: amounts.split(',').map((x) => Number(x.trim())).filter((x) => x > 0),
      options: f.options.map((o) => ({ es: o.es, en: o.en, p: Number(o.p) || 0 })),
      fields: f.fields.map((x) => ({ ...x, digits: x.type === 'tel' && x.digits ? Number(x.digits) : undefined })),
    };
    const q = id === 'nuevo' ? supabase.from('services').insert(payload) : supabase.from('services').update(payload).eq('id', id);
    const { error } = await q;
    setBusy(false);
    if (error) setErr(errMsg(error));
    else router.back();
  };

  const TYPES: { v: FieldType; label: string }[] = [
    { v: 'select', label: L('Lista de opciones', 'Option list') },
    { v: 'tel', label: L('Número', 'Number') },
    { v: 'text', label: L('Texto corto', 'Short text') },
    { v: 'photo', label: L('Foto', 'Photo') },
  ];
  const MODES: { v: Mode; label: string; icon: string }[] = [
    { v: 'digital', label: L('Sin salir de casa', 'From home'), icon: 'home' },
    { v: 'store', label: L('Recoger en tienda', 'Pick up in store'), icon: 'store' },
    { v: 'curb', label: L('Sin bajar del carro', 'Curbside'), icon: 'car' },
    { v: 'home', label: L('A domicilio', 'Home delivery'), icon: 'truck' },
  ];

  return (
    <Screen wide>
      <BackBar title={id === 'nuevo' ? L('Servicio nuevo', 'New service') : nm(f)} />
      <Card>
        <H2>{L('Datos del servicio', 'Service details')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre (español)', 'Name (Spanish)')} value={f.es} onChangeText={(v) => set('es', v)} />
          <Field label={L('Nombre (inglés)', 'Name (English)')} value={f.en} onChangeText={(v) => set('en', v)} />
        </Row>
        <Label>{L('Ícono del servicio', 'Service icon')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {ICON_CHOICES.map((n) => (
            <Pressable key={n} accessibilityRole="radio" accessibilityLabel={n} accessibilityState={{ checked: f.icon === n }} onPress={() => set('icon', n)}
              style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: f.icon === n ? C.gold : C.line, backgroundColor: f.icon === n ? C.icoBg : C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon n={n} size={22} color={f.icon === n ? C.brown : C.ink} />
            </Pressable>
          ))}
        </View>
        <Pills label={L('Categoría', 'Category')} options={cats.map((c) => ({ v: c.id, label: nm(c), icon: c.icon }))} value={f.cat_id} onChange={(v) => set('cat_id', v)} />
        <Field label={L('Descripción (español)', 'Description (Spanish)')} value={f.desc_es} onChangeText={(v) => set('desc_es', v)} />
        <Field label={L('Descripción (inglés)', 'Description (English)')} value={f.desc_en} onChangeText={(v) => set('desc_en', v)} />
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Tiempo (español)', 'Time (Spanish)')} value={f.eta_es} onChangeText={(v) => set('eta_es', v)} placeholder="24 horas" />
          <Field label={L('Tiempo (inglés)', 'Time (English)')} value={f.eta_en} onChangeText={(v) => set('eta_en', v)} placeholder="24 hours" />
        </Row>
      </Card>

      <Card>
        <H2>{L('Precio', 'Price')}</H2>
        <Pills
          wrap
          options={[
            { v: 'fixed', label: L('Precio fijo', 'Fixed price') },
            { v: 'amount', label: L('El cliente elige el monto', 'Customer picks amount') },
            { v: 'options', label: L('Opciones con precio', 'Priced options') },
          ]}
          value={f.price_type}
          onChange={(v) => set('price_type', v as Service['price_type'])}
        />
        <Row style={{ alignItems: 'flex-start' }}>
          {f.price_type === 'fixed' ? <Field label={L('Precio (USD)', 'Price (USD)')} value={String(f.base)} onChangeText={(v) => set('base', v as unknown as number)} keyboardType="decimal-pad" /> : null}
          {f.price_type === 'amount' ? <Field label={L('Montos sugeridos (separados por coma)', 'Suggested amounts (comma separated)')} value={amounts} onChangeText={setAmounts} /> : null}
          <Field label={L('Comisión (USD)', 'Fee (USD)')} value={String(f.fee)} onChangeText={(v) => set('fee', v as unknown as number)} keyboardType="decimal-pad" />
        </Row>
        {f.price_type === 'options' ? (
          <>
            {f.options.map((o, i) => (
              <Row key={i} style={{ alignItems: 'flex-end' }}>
                <Field label={L('Opción (español)', 'Option (Spanish)')} value={o.es} onChangeText={(v) => setOpt(i, { es: v })} />
                <Field label={L('Opción (inglés)', 'Option (English)')} value={o.en} onChangeText={(v) => setOpt(i, { en: v })} />
                <Field label={L('Precio', 'Price')} value={String(o.p)} onChangeText={(v) => setOpt(i, { p: v })} keyboardType="decimal-pad" style={{ maxWidth: 140 }} />
                <Btn small kind="danger" title={L('Quitar', 'Remove')} onPress={() => set('options', f.options.filter((_, j) => j !== i))} />
              </Row>
            ))}
            <Btn small kind="ghost" title={'+ ' + L('Agregar opción', 'Add option')} onPress={() => set('options', [...f.options, { es: '', en: '', p: 0 }])} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : null}
      </Card>

      <Card>
        <H2>{L('Datos que pide al cliente', 'Information asked from the customer')}</H2>
        <P small muted>{L('Usa listas de opciones siempre que se pueda: el cliente toca un botón en lugar de escribir.', 'Use option lists whenever possible: the customer taps a button instead of typing.')}</P>
        {f.fields.map((x, i) => (
          <View key={i} style={{ gap: 8, padding: 12, borderRadius: R.md, backgroundColor: C.cream }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Field label={L('Pregunta (español)', 'Question (Spanish)')} value={x.es} onChangeText={(v) => setField(i, { es: v })} />
              <Field label={L('Pregunta (inglés)', 'Question (English)')} value={x.en} onChangeText={(v) => setField(i, { en: v })} />
            </Row>
            <Pills wrap options={TYPES} value={x.type} onChange={(v) => setField(i, { type: v })} />
            {x.type === 'select' ? <Field label={L('Opciones (separadas por coma)', 'Options (comma separated)')} value={x.opts || ''} onChangeText={(v) => setField(i, { opts: v })} /> : null}
            {x.type === 'tel' ? <Field label={L('Dígitos exactos (vacío = cualquiera)', 'Exact digits (empty = any)')} value={String(x.digits ?? '')} onChangeText={(v) => setField(i, { digits: v.replace(/\D/g, '') })} keyboardType="number-pad" style={{ maxWidth: 260 }} /> : null}
            <Row>
              <Toggle label={L('Opcional', 'Optional')} value={!!x.optional} onChange={(v) => setField(i, { optional: v })} />
              <Btn small kind="danger" title={L('Quitar dato', 'Remove field')} onPress={() => set('fields', f.fields.filter((_, j) => j !== i))} />
            </Row>
          </View>
        ))}
        <Btn small kind="ghost" title={'+ ' + L('Agregar dato', 'Add field')} style={{ alignSelf: 'flex-start' }}
          onPress={() => set('fields', [...f.fields, { k: 'f' + Date.now().toString(36), es: '', en: '', type: 'select', opts: '' }])} />
      </Card>

      <Card>
        <H2>{L('Cómo se entrega', 'How it is delivered')}</H2>
        <Row gap={10} style={{ alignItems: 'stretch' }}>
          {MODES.map((m) => (
            <Toggle key={m.v} icon={m.icon} label={m.label} value={f.modes.includes(m.v)}
              onChange={(v) => {
                const next = v ? [...f.modes, m.v] : f.modes.filter((x) => x !== m.v);
                if (next.length) set('modes', next);
              }} />
          ))}
        </Row>
        <Row gap={10}>
          <Toggle icon="star" label={L('Suma puntos de lealtad', 'Earns loyalty points')} value={f.points} onChange={(v) => set('points', v)} />
          <Toggle icon="eye" label={L('Visible para los clientes', 'Visible to customers')} value={f.activo} onChange={(v) => set('activo', v)} />
        </Row>
      </Card>

      {err ? <Note kind="red">{err}</Note> : null}
      <Btn title={L('Guardar servicio', 'Save service')} onPress={save} loading={busy} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
