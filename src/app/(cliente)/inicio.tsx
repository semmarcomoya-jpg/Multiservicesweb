import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Scenery, Wallpaper, FramedImage } from '@/components/art';
import { OrderRow } from '@/components/orders';
import { ViewSwitch } from '@/components/panel';
import { Destacados } from '@/components/Destacados';
import { Stars } from '@/components/Stars';
import { Tour, tourDone } from '@/components/Tour';
import { NotifBell } from '@/components/NotifBell';
import { usePostKinds } from '@/components/PostCard';
import { StoriesRow } from '@/components/StoriesRow';
import { useDestacados } from '@/lib/featured';
import { useMyPoints } from '@/lib/points';
import { Text } from '@/components/Text';
import { Avatar, BrandChip, Circ, Empty, Icon, LangToggle, Loading, NavyHead, Note, P } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, prodFrom, useProducts, useSettings, useStores, scoreOf, useStoreScores } from '@/lib/data';
import { money } from '@/lib/format';
import { useBranding } from '@/lib/branding';
import { useQuery } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { countryOf, paisCfg } from '@/lib/countries';
import { Scene, type SceneName } from '@/components/scenes';
import { openState } from '@/lib/hours';
import { useMyOrders } from '@/lib/myorders';
import { autoOpenDecided, fetchStories, takeAutoOpen } from '@/lib/stories';
import type { Post, Promo, Story } from '@/lib/types';
import { C } from '@/lib/theme';

// Dentro del celular de la vista de escritorio del personal no se repite el selector
const inFrame = typeof window !== 'undefined' && window.self !== window.top;

export default function Inicio() {
  const { L, lang } = useLang();
  const { profile } = useAuth();
  const { data: cfg } = useSettings();
  const { data: stores } = useStores();
  const { data: products } = useProducts(null);
  const { orders } = useMyOrders(5);
  const { brand } = useBranding();
  const destacados = useDestacados();
  const params = useLocalSearchParams<{ tour?: string }>();
  const [tour, setTour] = useState(false);
  const [focused, setFocused] = useState(true);
  const [fw, setFw] = useState(0);
  const [fi, setFi] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { balance } = useMyPoints(profile?.id);
  const { data: scores } = useStoreScores();
  const K = usePostKinds();
  // Lo más reciente de Boca a boca (de tu tienda y los avisos para todos)
  const [feed, setFeed] = useState<Post[]>([]);
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('posts')
        .select('*, post_replies(id)')
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(12)
        .then(({ data }) => {
          const all = (data as Post[]) ?? [];
          const fav = profile?.store_id;
          const mine = fav ? all.filter((p) => p.store_id === fav || p.store_id === null) : all;
          setFeed((mine.length ? mine : all).slice(0, 3));
        });
    }, [profile?.store_id]),
  );
  // Recordatorio: el pedido completado más reciente que aún no calificas (de los últimos 14 días)
  const [toRate, setToRate] = useState<{ id: string; folio: string; who: string } | null>(null);
  useEffect(() => {
    const done = (orders || []).filter((o) => o.status === 'completado' && Date.now() - new Date(o.updated_at || o.created_at).getTime() < 14 * 864e5);
    if (!done.length) return setToRate(null);
    supabase
      .from('ratings')
      .select('order_id')
      .in('order_id', done.map((o) => o.id))
      .then(({ data }) => {
        const rated = new Set((data || []).map((r: { order_id: string }) => r.order_id));
        const o = done.find((x) => !rated.has(x.id));
        setToRate(o ? { id: o.id, folio: o.folio, who: o.attended_name || '' } : null);
      });
  }, [orders]);
  const { data: adminPromos } = useQuery<Promo[]>(() => supabase.from('promos').select('*').eq('activo', true).order('orden'));

  // Historias: igual que en Viva, al entrar se abren solas una vez por visita (primero las nuevas).
  // Mientras se decide, Inicio queda tapado para que no parpadee; si tardan más de 3 s, se muestra igual.
  const [stories, setStories] = useState<Story[] | null>(null);
  const [covering, setCovering] = useState(() => !autoOpenDecided());
  // Se vuelven a leer cada vez que regresas a Inicio (así aparecen las recién subidas)
  useFocusEffect(
    useCallback(() => {
      void fetchStories().then(setStories);
    }, []),
  );
  useEffect(() => {
    if (!covering) return undefined;
    const t = setTimeout(() => setCovering(false), 3000);
    return () => clearTimeout(t);
  }, [covering]);
  // Guía de bienvenida: la primera vez (o desde Perfil → "Ver la guía"), cuando Inicio ya está a la vista
  useEffect(() => {
    if (covering || !focused || !profile || inFrame) return undefined;
    if (tourDone() && params.tour !== '1') return undefined;
    const t = setTimeout(() => setTour(true), 700);
    return () => clearTimeout(t);
  }, [covering, focused, profile, params.tour]);
  useEffect(() => {
    if (stories === null) return undefined;
    if (!stories.length) {
      setCovering(false);
      return undefined;
    }
    let alive = true;
    let reveal: ReturnType<typeof setTimeout> | undefined;
    void takeAutoOpen(stories).then((id) => {
      if (!alive) return;
      if (!id) return setCovering(false);
      router.push({ pathname: '/historias', params: { id } });
      reveal = setTimeout(() => setCovering(false), 600);
    });
    return () => {
      alive = false;
      if (reveal) clearTimeout(reveal);
    };
  }, [stories]);
  const any = (k: 'send' | 'svc' | 'shop') => (stores || []).some((st) => st.activo && modOn(st, k));
  const myStore = (stores || []).find((s) => s.id === profile?.store_id);
  const myScore = myStore ? scoreOf(scores, myStore.id) : undefined;
  const ptsStore = (myStore && myStore.loyalty?.on ? myStore : (stores || []).find((s) => s.activo && s.loyalty?.on)) || null;
  const bday = profile?.fecha_nac && new Date(profile.fecha_nac + 'T12:00:00').getMonth() === new Date().getMonth();
  const minPhone = (products || []).filter((p) => p.activo && p.family_id === 'cel').map(prodFrom).filter((x) => Number.isFinite(x));
  // Tipo de cambio del país del cliente (si se le envía); si no, México
  const myPais = profile?.pais && profile.pais !== 'US' && paisCfg(cfg, profile.pais).on && paisCfg(cfg, profile.pais).rate ? profile.pais : 'MX';
  const pc = paisCfg(cfg, myPais);
  const rate = cfg ? pc.rate : 0;
  const updated = cfg ? new Date(cfg.rate_updated_at).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const PROMO_BG = { shop: C.brown, send: '#0B2E5E', pts: C.goldInk } as const;
  const PROMO_GO = { shop: '/productos', send: '/enviar', services: '/servicios', none: '' } as const;
  const PROMO_IC = { shop: 'phone', send: 'send', pts: 'star' } as const;
  const fromAdmin = (adminPromos || []).map((p) => ({ bg: PROMO_BG[p.theme] || C.brown, icon: PROMO_IC[p.theme] || 'star', t: lang === 'es' ? p.title_es : p.title_en || p.title_es, s: lang === 'es' ? p.sub_es : p.sub_en || p.sub_es, go: PROMO_GO[p.go] || '', img: p.img_url }));
  const computed = [
    any('shop') && minPhone.length && { bg: C.brown, icon: 'phone', t: L(`Celulares desde ${money(Math.min(...minPhone))}`, `Phones from ${money(Math.min(...minPhone))}`), s: L('Recoge hoy en tu tienda', 'Pick up today at your store'), go: '/productos?fam=cel' },
    any('send') && { bg: C.blue, icon: 'send', t: L(`Hoy tu dólar vale ${rate.toFixed(2)}`, `Today your dollar is worth ${rate.toFixed(2)}`), s: L('Envía a tu familia en minutos', 'Send to your family in minutes'), go: '/enviar' },
    any('svc') && { bg: C.goldInk, icon: 'bolt', t: L('Paga tus recibos sin salir', 'Pay your bills from home'), s: L('Luz, agua, recargas y más', 'Power, water, top-ups and more'), go: '/servicios' },
  ].filter(Boolean) as { bg: string; icon: string; t: string; s: string; go: string; img?: string | null }[];
  // Las promociones que sube el administrador; si no hay, unas automáticas
  const promos = fromAdmin.length ? fromAdmin : computed;

  const need = [
    any('svc') && { sc: 'luz' as SceneName, bg: '#FFF4D6', label: L('Pagar recibos', 'Pay bills'), sub: L('Luz, agua, CFE y más', 'Power, water and more'), go: '/servicios?cat=pag' },
    any('svc') && { sc: 'recarga' as SceneName, bg: '#E3F0FF', label: L('Recargas', 'Top-ups'), sub: L('Saldo y planes al momento', 'Credit and plans instantly'), go: '/servicios?cat=rec' },
    any('shop') && { sc: 'celular' as SceneName, bg: '#E8F6EE', label: L('Celulares', 'Phones'), sub: minPhone.length ? L(`Desde ${money(Math.min(...minPhone))}`, `From ${money(Math.min(...minPhone))}`) : L('Nuevos y con garantía', 'New, with warranty'), go: '/productos?fam=cel' },
    any('svc') && { sc: 'tramite' as SceneName, bg: '#F1EBFF', label: L('Trámites', 'Paperwork'), sub: L('Actas, traducciones y más', 'Certificates, translations'), go: '/servicios?cat=tra' },
    any('svc') && { sc: 'paquete' as SceneName, bg: '#FFE9E0', label: L('Paquetería', 'Parcels'), sub: L('Manda cajas a tu país', 'Ship boxes home'), go: '/servicios?cat=paq' },
    any('shop') && { sc: 'funda' as SceneName, bg: '#E6F4F6', label: L('Accesorios', 'Accessories'), sub: L('Fundas, micas y cargadores', 'Cases, screen guards, chargers'), go: '/productos?fam=all' },
  ].filter(Boolean) as { sc: SceneName; bg: string; label: string; sub: string; go: string }[];

  const qa = [
    { ic: 'users', tone: 'gold', label: L('Mis personas', 'My people'), go: '/beneficiarios' },
    { ic: 'qr', tone: 'blue', label: L('Mi tarjeta', 'My card'), go: '/tarjeta' },
    { ic: 'receipt', tone: 'blue', label: L('Mis pedidos', 'My orders'), go: '/pedidos' },
    cfg?.credit?.on !== false && (stores || []).some((st) => st.activo && (modOn(st, 'credit') || modOn(st, 'layaway'))) && { ic: 'wallet', tone: 'gold', label: L('Mi crédito', 'My credit'), go: '/credito' },
    (stores || []).some((st) => st.activo && modOn(st, 'comm')) && { ic: 'chat', tone: 'gold', label: L('Boca a boca', 'Word of mouth'), go: '/comunidad' },
  ].filter(Boolean) as { ic: string; tone: 'gold' | 'blue'; label: string; go: string }[];

  // Carrusel: tu pedido activo, las promociones y tus puntos
  const active = (orders || []).find((o) => o.status === 'verificar' || o.status === 'proceso');
  const pts = ptsStore ? balance(ptsStore.id) : 0;
  const nextRw = ptsStore?.loyalty?.rewards?.filter((r) => Number(r.pts) > pts).sort((a, b) => a.pts - b.pts)[0];
  const feats: { key: string; sc: SceneName; lbl: string; t: string; s: string; go: string; bg: [string, string]; img?: string | null }[] = [
    ...(active ? [{ key: 'o', sc: 'ok' as SceneName, lbl: active.status === 'verificar' ? L('Tu pedido · revisando el pago', 'Your order · checking payment') : L('Tu pedido · en proceso', 'Your order · in progress'), t: active.folio, s: L('Toca para ver cómo va', 'Tap to see its status'), go: `/pedido/${active.id}`, bg: ['#0B2E5E', '#1656A8'] as [string, string] }] : []),
    ...promos.map((p, i) => ({ key: 'p' + i, sc: (p.icon === 'phone' ? 'celular' : p.icon === 'send' ? 'envio' : p.icon === 'bolt' ? 'luz' : 'puntos') as SceneName, lbl: L('Promoción', 'Promotion'), t: p.t, s: p.s, go: p.go, img: p.img, bg: ['#0D4A82', '#2A8BDA'] as [string, string] })),
    ...(ptsStore ? [{ key: 'pts', sc: 'puntos' as SceneName, lbl: L('Tus puntos', 'Your points'), t: nextRw ? L(`${pts} pts · te faltan ${nextRw.pts - pts}`, `${pts} pts · ${nextRw.pts - pts} to go`) : `${pts} pts`, s: nextRw ? L(`Para "${nextRw.es}"`, `For "${nextRw.en || nextRw.es}"`) : L('Úsalos en tu tienda', 'Use them at your store'), go: '/puntos', bg: ['#7A4A00', '#E8A317'] as [string, string] }] : []),
  ];
  const tiles: { sc: SceneName; label: string; go: string }[] = [
    any('send') && { sc: 'envio' as SceneName, label: L('Enviar dinero', 'Send money'), go: '/enviar' },
    any('svc') && { sc: 'luz' as SceneName, label: L('Pagar luz o agua', 'Pay bills'), go: '/servicios?cat=pag' },
    any('svc') && { sc: 'recarga' as SceneName, label: L('Recargas', 'Top-ups'), go: '/servicios?cat=rec' },
    any('shop') && { sc: 'celular' as SceneName, label: L('Celulares', 'Phones'), go: '/productos?fam=cel' },
    any('svc') && { sc: 'paquete' as SceneName, label: L('Caja a tu país', 'Ship a box'), go: '/servicios?cat=paq' },
    any('svc') && { sc: 'tramite' as SceneName, label: L('Trámites', 'Paperwork'), go: '/servicios?cat=tra' },
  ].filter(Boolean) as { sc: SceneName; label: string; go: string }[];
  const web = typeof document !== 'undefined';

  return (
    <View style={{ flex: 1 }}>
      <Wallpaper theme="home" />
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          {/* Encabezado azul con tipo de cambio y puntos (maqueta v2) */}
          <NavyHead>
            {brand.home_bg_url ? (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}>
                <FramedImage uri={brand.home_bg_url} frame={brand.home_pos} />
              </View>
            ) : null}
            <SafeAreaView edges={['top']}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                <BrandChip dark />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <LangToggle glass />
                  <NotifBell glass />
                </View>
              </View>
            </SafeAreaView>
            {profile && profile.role !== 'cliente' && !inFrame ? (
              <View style={{ alignItems: 'flex-start' }}>
                <ViewSwitch current="cliente" />
              </View>
            ) : null}
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>
              {L('Hola', 'Hi')}{profile?.nombre ? `, ${profile.nombre}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#B9D3F2' }}>{L('Tipo de cambio de hoy', "Today's rate")}{updated ? ` · ${updated}` : ''}</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{`${countryOf(myPais).flag} 1 USD = ${rate ? rate.toFixed(2) : '—'} ${pc.cur}`}</Text>
              </View>
              {ptsStore ? (
                <Pressable accessibilityRole="button" accessibilityLabel={L('Mis puntos', 'My points')} onPress={() => router.push('/puntos')}
                  style={{ backgroundColor: '#E8A317', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#3B2600' }}>{pts}</Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#5A3B00' }}>{L('PUNTOS', 'POINTS')}</Text>
                </Pressable>
              ) : null}
            </View>
          </NavyHead>

          <View style={{ marginHorizontal: 16, marginTop: 12, gap: 14 }}>
            {stories && (stories.length || (profile && profile.role !== 'cliente')) ? (
              <StoriesRow stories={stories} addHref={profile?.role === 'admin' ? '/admin/historias' : profile?.role === 'tienda' ? '/tienda/historias' : undefined} />
            ) : null}

            {/* ¿Qué necesitas? — 6 cuadritos con ilustración */}
            {tiles.length ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16.5, fontWeight: '900', color: C.ink }}>{L('¿Qué necesitas?', 'What do you need?')}</Text>
                  <Pressable accessibilityRole="link" onPress={() => router.push('/servicios')}><Text style={{ fontWeight: '800', color: C.brown }}>{L('Ver todo', 'See all')}</Text></Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tiles.map((a) => (
                    <Pressable key={a.label} accessibilityRole="button" onPress={() => router.push(a.go as never)}
                      style={({ pressed }) => ({ width: '31.5%', flexGrow: 1, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', opacity: pressed ? 0.8 : 1 })}>
                      <View style={{ height: 58, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
                        <Scene n={a.sc} size={54} />
                      </View>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.ink, textAlign: 'center', paddingVertical: 6, paddingHorizontal: 4 }} numberOfLines={2}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Carrusel con puntitos: pedido activo, promociones y puntos */}
            {feats.length ? (
              <View style={{ gap: 6 }} onLayout={(e) => setFw(e.nativeEvent.layout.width)}>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={(e) => fw && setFi(Math.round(e.nativeEvent.contentOffset.x / fw))} scrollEventThrottle={32}>
                  {feats.map((f) => (
                    <Pressable key={f.key} accessibilityRole="button" onPress={() => f.go && router.push(f.go as never)}
                      style={{ width: fw || 340, minHeight: 104, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', backgroundColor: f.bg[0], ...(web ? ({ backgroundImage: `linear-gradient(120deg, ${f.bg[0]}, ${f.bg[1]})` } as object) : {}) }}>
                      {f.img ? (
                        <>
                          <Image source={{ uri: f.img }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
                          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,31,58,0.5)' }} />
                        </>
                      ) : (
                        <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                          <Scene n={f.sc} size={56} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 10.5, letterSpacing: 1, fontWeight: '900', color: '#BFE3FF', textTransform: 'uppercase' }}>{f.lbl}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }} numberOfLines={2}>{f.t}</Text>
                        <Text style={{ fontSize: 12.5, color: '#fff', opacity: 0.92 }} numberOfLines={2}>{f.s}</Text>
                      </View>
                      {f.go ? (
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon n="arrow" size={18} color="#0B2E5E" />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
                {feats.length > 1 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                    {feats.map((f, i) => <View key={f.key} style={{ width: i === fi ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === fi ? C.brown : C.line2 }} />)}
                  </View>
                ) : null}
              </View>
            ) : null}

            {bday ? (
              <Note kind="gold" icon="gift">
                {L(`¡Feliz cumpleaños, ${profile?.nombre}! Este mes te consentimos en tu tienda.`, `Happy birthday, ${profile?.nombre}! This month we treat you at your store.`)}
              </Note>
            ) : null}

            {toRate ? (
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: toRate.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 2, borderColor: C.gold }}>
                <Stars value={0} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '900', color: C.ink }}>{toRate.who ? L(`¿Cómo te atendió ${toRate.who}?`, `How did ${toRate.who} do?`) : L('¿Cómo te atendimos?', 'How did we do?')}</Text>
                  <P small muted>{L(`Califica tu pedido ${toRate.folio}. Toma 5 segundos.`, `Rate your order ${toRate.folio}. Takes 5 seconds.`)}</P>
                </View>
                <Icon n="arrow" size={18} color={C.brown} />
              </Pressable>
            ) : null}

            {/* Destacados: lo que elige el administrador o lo más vendido */}
            {destacados ? <Destacados items={destacados} /> : null}

            {/* Boca a boca: lo más reciente de la comunidad */}
            {feed.length ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('Boca a boca', 'Word of mouth')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/comunidad')}>
                    <Text style={{ fontWeight: '900', color: C.blue }}>{L('Ver todo', 'See all')}</Text>
                  </Pressable>
                </View>
                {feed.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/comunidad', params: { post: p.id } })}
                    style={({ pressed }) => ({ padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 6, opacity: pressed ? 0.85 : 1 })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Avatar name={p.author_name} size={28} uri={p.author_foto} me={p.kind === 'store' || p.kind === 'aviso'} />
                      <Text style={{ flex: 1, fontWeight: '900', color: C.ink }} numberOfLines={1}>{p.author_name}</Text>
                      {p.kind === 'reco' && p.stars ? <Stars value={p.stars} size={13} /> : <Text style={{ fontSize: 11, fontWeight: '900', color: C.brown }}>{K[p.kind].label}</Text>}
                    </View>
                    <Text style={{ color: C.ink }} numberOfLines={2}>{p.text}</Text>
                    {(p.post_replies || []).length ? <P small muted>{L(`${(p.post_replies || []).length} comentarios`, `${(p.post_replies || []).length} comments`)}</P> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Pedidos recientes */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('Tus pedidos recientes', 'Your recent orders')}</Text>
              {orders && orders.length ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/pedidos')}>
                  <Text style={{ fontWeight: '900', color: C.blue }}>{L('Ver todo', 'See all')}</Text>
                </Pressable>
              ) : null}
            </View>
            {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
            {(orders || []).map((o) => (
              <OrderRow key={o.id} o={o} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
            ))}

            {/* Tu tienda */}
            <Pressable accessibilityRole="button" onPress={() => router.push(myStore ? `/sucursal/${myStore.id}` : '/perfil')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E1E9F3', backgroundColor: C.card }}>
              {myStore?.fotos?.[0] ? (
                <Image source={{ uri: myStore.fotos[0] }} style={{ width: 72, height: 56, borderRadius: 14, backgroundColor: C.blueSoft }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon n="store" size={24} color={C.blue} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <P small>{L('Tu tienda', 'Your store')}</P>
                  {myScore && Number(myScore.total) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Stars value={Number(myScore.promedio)} size={12} />
                      <Text style={{ fontSize: 12, fontWeight: '900', color: C.ink }}>{Number(myScore.promedio).toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontWeight: '900', fontSize: 15, color: C.ink }}>{myStore ? myStore.nombre : L('Elige tu tienda favorita', 'Choose your favorite store')}</Text>
                {myStore ? <P small>{[myStore.direccion, myStore.ciudad].filter(Boolean).join(' · ')}</P> : null}
                {myStore ? <Text style={{ fontSize: 12, fontWeight: '800', color: openState(myStore).open ? '#1F7A45' : '#B45309' }}>{openState(myStore).label[lang]}</Text> : null}
              </View>
              <Text style={{ fontWeight: '800', color: C.blue }}>{myStore ? L('Ver', 'View') : L('Elegir', 'Choose')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {covering ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.page, justifyContent: 'center' }}>
          <Loading />
        </View>
      ) : null}
      <Tour visible={tour && focused} onClose={() => { setTour(false); if (params.tour) router.setParams({ tour: undefined }); }} />
    </View>
  );
}
