/** Ficha pública de una sucursal: la abre el QR del cartel y "Ver sucursal". */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { BackBar, Btn, Card, Empty, H1, IcoBox, Loading, P, Pills, Row, Screen } from '@/components/ui';
import { modOn, prodFrom, prodName, scoreOf, storesForService, useProducts, useServices, useStoreScores, useStores } from '@/lib/data';
import { digits, money } from '@/lib/format';
import { DAY_NAMES, fmtTime, hoursOf, openState } from '@/lib/hours';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Post } from '@/lib/types';

type Tab = 'svc' | 'shop' | 'rev' | 'info';

export default function Sucursal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { L, lang, nm } = useLang();
  const { data: stores } = useStores();
  const { data: services } = useServices();
  const { data: products } = useProducts(id);
  const { data: scores } = useStoreScores();
  const [tab, setTab] = useState<Tab>('svc');
  const [revs, setRevs] = useState<Post[] | null>(null);
  useEffect(() => {
    supabase.from('posts').select('*').eq('store_id', id).eq('kind', 'reco').eq('hidden', false).gt('stars', 0).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setRevs((data as Post[]) ?? []));
  }, [id]);

  if (!stores) return <Loading />;
  const st = stores.find((s) => s.id === id && s.activo);
  if (!st) return <Screen><BackBar /><Empty>{L('No encontramos esta sucursal.', 'We could not find this branch.')}</Empty></Screen>;

  const os = openState(st);
  const sc = scoreOf(scores, st.id);
  const svcs = (services || []).filter((s) => s.activo !== false && storesForService([st], s).length);
  const prods = (products || []).filter((p) => p.activo && p.product_variants?.some((v) => v.activo));
  const hs = hoursOf(st);
  const tel = digits(st.telefono || '');
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${st.direccion} ${st.ciudad}`)}`;
  const tabs: { v: Tab; label: string }[] = [
    ...(modOn(st, 'svc') ? [{ v: 'svc' as Tab, label: L('Servicios', 'Services') }] : []),
    ...(modOn(st, 'shop') && prods.length ? [{ v: 'shop' as Tab, label: L('Tienda', 'Shop') }] : []),
    { v: 'rev', label: L(`Reseñas${sc?.total ? ` (${sc.total})` : ''}`, `Reviews${sc?.total ? ` (${sc.total})` : ''}`) },
    { v: 'info', label: L('Info', 'Info') },
  ];
  const cur = tabs.some((t) => t.v === tab) ? tab : tabs[0].v;

  return (
    <Screen>
      <BackBar title={st.nombre} />
      <View style={{ borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.brownDark }}>
        {st.fotos?.[0] ? <Image source={{ uri: st.fotos[0] }} style={{ width: '100%', height: 170 }} resizeMode="cover" accessibilityLabel={st.nombre} /> : null}
        <View style={{ padding: 16, gap: 8 }}>
          <H1 style={{ color: '#fff' }}>{st.nombre}</H1>
          <Row gap={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: os.open ? '#D8F3E3' : '#FDE7D2' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: os.open ? '#1F9D55' : '#C2410C' }} />
              <Text style={{ fontWeight: '800', fontSize: 13, color: os.open ? '#14532D' : '#7C2D12' }}>{os.label[lang]}</Text>
            </View>
            {sc && Number(sc.total) > 0 ? <Text style={{ color: C.gold, fontWeight: '900' }}>{`★ ${Number(sc.promedio).toFixed(1)}`}<Text style={{ color: '#fff', fontWeight: '600' }}>{` · ${sc.total} ${L('reseñas', 'reviews')}`}</Text></Text> : null}
          </Row>
          <Text style={{ color: '#E6EEF9' }}>{[st.direccion, st.ciudad].filter(Boolean).join(', ')}</Text>
          <Row gap={8}>
            <Btn small kind="soft" icon="car" title={L('Cómo llegar', 'Directions')} onPress={() => Linking.openURL(mapUrl)} />
            {tel ? <Btn small kind="ghost" icon="phone" title={L('Llamar', 'Call')} onPress={() => Linking.openURL('tel:' + tel)} /> : null}
          </Row>
        </View>
      </View>
      {st.abierta === false && st.aviso_cerrada ? <P small muted>{st.aviso_cerrada}</P> : null}

      <Pills options={tabs} value={cur} onChange={setTab} />

      {cur === 'svc' ? (
        <Card>
          {svcs.length ? svcs.map((s) => (
            <Pressable key={s.id} accessibilityRole="link" onPress={() => router.push(`/servicio/${s.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.7 : 1 })}>
              <IcoBox n={s.icon || 'tool'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.ink }}>{nm(s)}</Text>
                <P small muted>{lang === 'es' ? s.desc_es : s.desc_en || s.desc_es}</P>
              </View>
              {s.price_type === 'fixed' && Number(s.base) > 0 ? <Text style={{ fontWeight: '900', color: C.ink }}>{money(s.base)}</Text> : null}
            </Pressable>
          )) : <P muted>{L('Esta sucursal no tiene servicios por ahora.', 'This branch has no services right now.')}</P>}
        </Card>
      ) : null}

      {cur === 'shop' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {prods.map((p) => (
            <Pressable key={p.id} accessibilityRole="link" onPress={() => router.push(`/producto/${p.id}`)}
              style={{ width: '48%', flexGrow: 1, maxWidth: 220, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
              {p.fotos?.[0] || p.foto_url ? <Image source={{ uri: (p.fotos?.[0] || p.foto_url) as string }} style={{ width: '100%', height: 110 }} resizeMode="contain" /> : <View style={{ height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: C.tint }}><IcoBox n="bag" /></View>}
              <View style={{ padding: 10, gap: 2 }}>
                <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={2}>{prodName(p)}</Text>
                {Number.isFinite(prodFrom(p)) ? <Text style={{ fontWeight: '900', color: C.brown }}>{L('Desde ', 'From ') + money(prodFrom(p))}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {cur === 'rev' ? (
        <Card>
          {!revs ? <Loading /> : revs.length ? revs.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: C.ink }}>{r.author_name || L('Cliente', 'Customer')}</Text>
                <Text style={{ color: C.gold, fontWeight: '900' }}>{'★'.repeat(Math.round(r.stars)) + '☆'.repeat(5 - Math.round(r.stars))}</Text>
              </Row>
              {r.text ? <P>{r.text}</P> : null}
              <P small muted>{new Date(r.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</P>
            </View>
          )) : <P muted>{L('Todavía no hay reseñas. ¡Sé el primero en recomendarla!', 'No reviews yet. Be the first to recommend it!')}</P>}
          <Btn small kind="ghost" icon="star" title={L('Escribir una reseña', 'Write a review')} style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/comunidad/nueva')} />
        </Card>
      ) : null}

      {cur === 'info' ? (
        <Card>
          {st.descripcion ? <P>{st.descripcion}</P> : null}
          <Text style={{ fontWeight: '900', color: C.ink }}>{L('Horario', 'Hours')}</Text>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Row key={d} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ fontWeight: d === os.today ? '900' : '600', color: C.ink }}>{DAY_NAMES[lang][d]}</Text>
              <Text style={{ fontWeight: d === os.today ? '900' : '600', color: hs[d].on ? C.ink : C.muted }}>{hs[d].on ? `${fmtTime(hs[d].a, lang)} – ${fmtTime(hs[d].c, lang)}` : L('Cerrado', 'Closed')}</Text>
            </Row>
          ))}
          {st.telefono ? <P>{L('Teléfono: ', 'Phone: ') + st.telefono}</P> : null}
          <P>{L('Dirección: ', 'Address: ') + [st.direccion, st.ciudad].filter(Boolean).join(', ')}</P>
        </Card>
      ) : null}
    </Screen>
  );
}
