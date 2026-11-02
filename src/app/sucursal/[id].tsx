/** Ficha pública de una sucursal: la abre el QR del cartel y "Ver sucursal". */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { BackBar, BrandMark, Btn, Card, Empty, IcoBox, Icon, Loading, NavyHead, P, Row, Screen, Seg } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Scene, sceneFor } from '@/components/scenes';
import { useMyPoints } from '@/lib/points';
import { modOn, prodFrom, prodName, scoreOf, storesForService, useProducts, useServices, useStoreScores, useStores } from '@/lib/data';
import { digits, money } from '@/lib/format';
import { DAY_NAMES, fmtTime, hoursOf, openState, storeLink } from '@/lib/hours';
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
  const { profile } = useAuth();
  const { balance } = useMyPoints(profile?.id);
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
    { v: 'rev', label: L('Reseñas', 'Reviews') },
    { v: 'info', label: L('Info', 'Info') },
  ];
  const cur = tabs.some((t) => t.v === tab) ? tab : tabs[0].v;
  const share = async () => {
    const url = storeLink(st.id);
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) await nav.share({ title: st.nombre, url });
      else await navigator.clipboard?.writeText(url);
    } catch {}
  };

  return (
    <Screen>
      <NavyHead style={{ borderRadius: 22, paddingTop: 12 }}>
        {st.fotos?.[0] ? <Image source={{ uri: st.fotos[0] }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.25 }} resizeMode="cover" /> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Regresar', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/inicio'))}
            style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="back" size={20} color="#fff" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Compartir', 'Share')} onPress={share}
            style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="send" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#62BDF6' }}>
            <BrandMark size={40} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            {st.ciudad ? <Text style={{ color: '#C9DDF4', fontSize: 12.5, fontWeight: '700' }}>{st.ciudad}</Text> : null}
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900' }}>{st.nombre}</Text>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 2, borderRadius: R.pill, backgroundColor: os.open ? '#DDF1E4' : '#F7DCD6' }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: os.open ? '#1E7A4A' : '#B23A2A' }} />
              <Text style={{ fontWeight: '900', fontSize: 11.5, color: os.open ? '#1E7A4A' : '#B23A2A' }}>{os.label[lang]}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14 }}>
          {[
            [sc && Number(sc.total) ? `${Number(sc.promedio).toFixed(1)} ★` : '—', L(`${sc?.total || 0} reseñas`, `${sc?.total || 0} reviews`)],
            [String(svcs.length), L('servicios', 'services')],
            [profile && st.loyalty?.on ? String(balance(st.id)) : String(prods.length), profile && st.loyalty?.on ? L('tus puntos aquí', 'your points here') : L('productos', 'products')],
          ].map(([v, t], i) => (
            <View key={i} style={{ flex: 1, paddingVertical: 7, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.14)' }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{v}</Text>
              <Text style={{ color: '#C9DDF4', fontSize: 11 }}>{t}</Text>
            </View>
          ))}
        </View>
      </NavyHead>
      {st.abierta === false && st.aviso_cerrada ? <P small muted>{st.aviso_cerrada}</P> : null}

      <Seg options={tabs} value={cur} onChange={setTab} />

      {cur === 'svc' ? (
        <Card>
          {svcs.length ? svcs.map((s) => (
            <Pressable key={s.id} accessibilityRole="link" onPress={() => router.push(`/servicio/${s.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n={sceneFor(s.icon, s.cat_id)} size={40} /></View>
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
          {revs && revs.length ? (
            <Row style={{ alignItems: 'center', gap: 14, paddingBottom: 8 }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: C.ink }}>{(revs.reduce((x, r) => x + r.stars, 0) / revs.length).toFixed(1)}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = revs.filter((r) => Math.round(r.stars) === n).length;
                  return (
                    <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 11.5, color: C.muted, width: 10 }}>{n}</Text>
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
                        <View style={{ width: `${(c / revs.length) * 100}%`, height: '100%', backgroundColor: '#E8A317' }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Row>
          ) : null}
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
      {/* Botones fijos abajo */}
      <View style={{ position: 'sticky' as never, bottom: 0, flexDirection: 'row', gap: 8, paddingVertical: 10, backgroundColor: C.page }}>
        <Btn icon="send" title={L('Enviar desde aquí', 'Send from here')} style={{ flex: 1 }} onPress={() => router.push('/enviar')} />
        <Btn kind="ghost" icon="car" title={L('Llegar', 'Map')} onPress={() => Linking.openURL(mapUrl)} />
        {tel ? <Btn kind="ghost" icon="chat" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/1${tel.slice(-10)}`)} /> : null}
      </View>
    </Screen>
  );
}
