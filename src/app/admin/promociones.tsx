import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { PanelHeader } from '@/components/panel';
import { Text } from '@/components/Text';
import { Btn, Card, Field, Icon, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { useQuery } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Promo } from '@/lib/types';
import { uploadPublic } from '@/lib/upload';

const BG = { shop: C.brown, send: '#7A3412', pts: C.goldInk } as const;
const IC = { shop: 'phone', send: 'send', pts: 'star' } as const;

function PromoCard({ p, lang }: { p: Promo; lang: string }) {
  const t = lang === 'es' ? p.title_es : p.title_en || p.title_es;
  const s = lang === 'es' ? p.sub_es : p.sub_en || p.sub_es;
  return (
    <View style={[st.card, { backgroundColor: BG[p.theme] || C.brown }]}>
      {p.img_url ? (
        <>
          <Image source={{ uri: p.img_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(46,27,16,0.45)' }]} />
        </>
      ) : (
        <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.22 }}>
          <Icon n={IC[p.theme] || 'star'} size={110} color="#fff" sw={1.4} />
        </View>
      )}
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19, lineHeight: 22 }}>{t || '—'}</Text>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 4 }}>{s}</Text>
    </View>
  );
}

export default function AdminPromos() {
  const { L, lang } = useLang();
  const { data, reload } = useQuery<Promo[]>(() => supabase.from('promos').select('*').order('orden'));
  const [list, setList] = useState<Promo[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (data) setList(data);
  }, [data]);
  if (!data) return <Loading />;

  const edit = (id: string, patch: Partial<Promo>) => {
    setList((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty((d) => ({ ...d, [id]: true }));
    setMsg('');
  };
  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, ok?: string) => {
    setBusy(key);
    setErr('');
    const { error } = await fn();
    setBusy('');
    if (error) return setErr(errMsg(error));
    if (ok) setMsg(ok);
    reload();
  };
  const add = () =>
    run('add', () => supabase.from('promos').insert({ title_es: 'Nueva promoción', title_en: 'New promotion', sub_es: '', sub_en: '', go: 'shop', theme: 'shop', orden: (list.at(-1)?.orden || 0) + 1 }));
  const save = (p: Promo) =>
    run('s' + p.id, () => supabase.from('promos').update({ title_es: p.title_es, title_en: p.title_en, sub_es: p.sub_es, sub_en: p.sub_en, go: p.go, theme: p.theme, img_url: p.img_url, activo: p.activo }).eq('id', p.id), L('Promoción guardada.', 'Promotion saved.')).then(() =>
      setDirty((d) => ({ ...d, [p.id]: false })),
    );
  const quitar = (p: Promo) => run('d' + p.id, () => supabase.from('promos').delete().eq('id', p.id));
  const img = async (p: Promo) => {
    setBusy('i' + p.id);
    try {
      const url = await uploadPublic('promos');
      if (url) edit(p.id, { img_url: url });
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy('');
  };

  const GO: { v: Promo['go']; label: string }[] = [
    { v: 'shop', label: L('Tienda', 'Shop') },
    { v: 'send', label: L('Enviar dinero', 'Send money') },
    { v: 'services', label: L('Servicios', 'Services') },
    { v: 'none', label: L('Nada', 'Nothing') },
  ];
  const THEMES: { v: Promo['theme']; label: string }[] = [
    { v: 'shop', label: L('Naranja', 'Orange') },
    { v: 'send', label: L('Café', 'Brown') },
    { v: 'pts', label: L('Dorado', 'Gold') },
  ];

  return (
    <Screen wide>
      <PanelHeader kind="admin" />
      <P small muted>{L('Aparecen en la pantalla de inicio del cliente. Úsalas para ofertas, temporadas o avisos.', 'They appear on the customer home screen. Use them for offers, seasons or notices.')}</P>
      <Pressable accessibilityRole="button" onPress={add} disabled={busy === 'add'} style={st.add}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.brown, fontSize: 24, fontWeight: '900' }}>+</Text>
        </View>
        <Text style={{ color: C.brown, fontWeight: '800', fontSize: 16 }}>{busy === 'add' ? L('Agregando…', 'Adding…') : L('Agregar promoción', 'Add promotion')}</Text>
      </Pressable>
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      {list.length === 0 ? <P muted>{L('Sin promociones. Los clientes verán ofertas automáticas.', 'No promotions. Customers will see automatic offers.')}</P> : null}
      {list.map((p) => (
        <Card key={p.id}>
          <Row style={{ alignItems: 'flex-start', gap: 16 }}>
            <View style={{ width: 240, gap: 8, opacity: p.activo ? 1 : 0.5 }}>
              <PromoCard p={p} lang={lang} />
              {!p.activo ? <P small muted>{L('Oculta para los clientes', 'Hidden from customers')}</P> : null}
            </View>
            <View style={{ flex: 1, minWidth: 260, gap: 10 }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Field label={L('Título (español)', 'Title (Spanish)')} value={p.title_es} onChangeText={(v) => edit(p.id, { title_es: v })} />
                <Field label={L('Título (inglés)', 'Title (English)')} value={p.title_en} onChangeText={(v) => edit(p.id, { title_en: v })} />
                <Field label={L('Texto (español)', 'Text (Spanish)')} value={p.sub_es} onChangeText={(v) => edit(p.id, { sub_es: v })} />
                <Field label={L('Texto (inglés)', 'Text (English)')} value={p.sub_en} onChangeText={(v) => edit(p.id, { sub_en: v })} />
              </Row>
              <Pills label={L('Al tocarla lleva a', 'Tapping it opens')} options={GO} value={p.go} onChange={(v) => edit(p.id, { go: v })} />
              <Pills label={L('Color', 'Color')} options={THEMES} value={p.theme} onChange={(v) => edit(p.id, { theme: v })} />
              <Row>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: p.activo }} onPress={() => edit(p.id, { activo: !p.activo })} style={st.check}>
                  <View style={[st.box, p.activo && { backgroundColor: C.brown, borderColor: C.brown }]}>{p.activo ? <Icon n="check" size={14} color="#fff" sw={3} /> : null}</View>
                  <Text style={{ fontWeight: '700', color: C.ink }}>{L('Visible', 'Visible')}</Text>
                </Pressable>
                <Btn small kind="ghost" icon="image" title={L('Imagen', 'Image')} loading={busy === 'i' + p.id} onPress={() => img(p)} />
                {p.img_url ? <Btn small kind="ghost" title={L('Sin imagen', 'No image')} onPress={() => edit(p.id, { img_url: null })} /> : null}
                <Btn small kind="ghost" title={L('Quitar', 'Remove')} loading={busy === 'd' + p.id} onPress={() => quitar(p)} />
                <Btn small title={L('Guardar', 'Save')} disabled={!dirty[p.id]} loading={busy === 's' + p.id} onPress={() => save(p)} />
              </Row>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  card: { height: 118, borderRadius: 18, padding: 16, justifyContent: 'flex-end', overflow: 'hidden' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E8A27A', borderRadius: 18, padding: 16, backgroundColor: '#FFF4EA' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FBEBDD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
