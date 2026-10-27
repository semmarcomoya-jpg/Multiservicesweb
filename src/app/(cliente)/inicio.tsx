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
import { Avatar, BrandChip, Circ, Empty, Icon, LangToggle, Loading, Note, P } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, prodFrom, useProducts, useSettings, useStores, scoreOf, useStoreScores } from '@/lib/data';
import { money } from '@/lib/format';
import { useBranding } from '@/lib/branding';
import { useQuery } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
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
  const rate = cfg ? Number(cfg.exchange_rate) : 0;
  const updated = cfg ? new Date(cfg.rate_updated_at).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const PROMO_BG = { shop: C.brown, send: '#0B2E5E', pts: C.goldInk } as const;
  const PROMO_GO = { shop: '/productos', send: '/enviar', services: '/servicios', none: '' } as const;
  const PROMO_IC = { shop: 'phone', send: 'send', pts: 'star' } as const;
  const fromAdmin = (adminPromos || []).map((p) => ({ bg: PROMO_BG[p.theme] || C.brown, icon: PROMO_IC[p.theme] || 'star', t: lang === 'es' ? p.title_es : p.title_en || p.title_es, s: lang === 'es' ? p.sub_es : p.sub_en || p.sub_es, go: PROMO_GO[p.go] || '', img: p.img_url }));
  const computed = [
    any('shop') && minPhone.length && { bg: C.brown, icon: 'phone', t: L(`Celulares desde ${money(Math.min(...minPhone))}`, `Phones from ${money(Math.min(...minPhone))}`), s: L('Recoge hoy en tu tienda', 'Pick up today at your store'), go: '/productos?fam=cel' },
    any('send') && { bg: C.blue, icon: 'send', t: L(`Hoy tu dólar vale ${rate.toFixed(2)}`, `Today your dollar is worth ${rate.toFixed(2)}`), s: L('Envía a México en minutos', 'Send to Mexico in minutes'), go: '/enviar' },
    any('svc') && { bg: C.goldInk, icon: 'bolt', t: L('Paga tus recibos sin salir', 'Pay your bills from home'), s: L('Luz, agua, recargas y más', 'Power, water, top-ups and more'), go: '/servicios' },
  ].filter(Boolean) as { bg: string; icon: string; t: string; s: string; go: string; img?: string | null }[];
  // Las promociones que sube el administrador; si no hay, unas automáticas
  const promos = fromAdmin.length ? fromAdmin : computed;

  const qa = [
    (any('svc') || any('send')) && { ic: 'tool', tone: 'gold', label: L('Servicios', 'Services'), go: '/servicios' },
    any('shop') && { ic: 'phone', tone: 'blue', label: L('Celulares', 'Phones'), go: '/productos?fam=cel' },
    any('shop') && { ic: 'bag', tone: 'gold', label: L('Tienda', 'Shop'), go: '/productos?fam=all' },
    any('send') && { ic: 'send', tone: 'blue', label: L('Enviar dinero', 'Send money'), go: '/enviar' },
    { ic: 'users', tone: 'gold', label: L('Mis personas', 'My people'), go: '/beneficiarios' },
    { ic: 'qr', tone: 'blue', label: L('Mi tarjeta', 'My card'), go: '/tarjeta' },
    { ic: 'receipt', tone: 'blue', label: L('Mis pedidos', 'My orders'), go: '/pedidos' },
    cfg?.credit?.on !== false && (stores || []).some((st) => st.activo && (modOn(st, 'credit') || modOn(st, 'layaway'))) && { ic: 'wallet', tone: 'gold', label: L('Mi crédito', 'My credit'), go: '/credito' },
    (stores || []).some((st) => st.activo && modOn(st, 'comm')) && { ic: 'chat', tone: 'gold', label: L('Boca a boca', 'Word of mouth'), go: '/comunidad' },
  ].filter(Boolean) as { ic: string; tone: 'gold' | 'blue'; label: string; go: string }[];

  return (
    <View style={{ flex: 1 }}>
      <Wallpaper theme="home" />
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          {/* Portada */}
          <View style={{ height: 200, overflow: 'hidden', backgroundColor: '#D3E7FA' }}>
            {brand.home_bg_url ? <FramedImage uri={brand.home_bg_url} frame={brand.home_pos} /> : <Scenery mid />}
            <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 16, right: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
                <BrandChip />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <NotifBell glass />
                  <LangToggle glass />
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={{ marginTop: -58, marginHorizontal: 16, gap: 16 }}>
            {profile && profile.role !== 'cliente' && !inFrame ? (
              <View style={{ alignItems: 'center' }}>
                <ViewSwitch current="cliente" />
              </View>
            ) : null}
            {/* Saludo */}
            <View style={{ padding: 18, borderRadius: 22, backgroundColor: C.card, gap: 12, shadowColor: '#0B2E5E', shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={`${profile?.nombre || ''} ${profile?.apellidos || ''}`} size={44} uri={profile?.foto_url} />
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>
                  {L('Hola', 'Hi')}, {profile?.nombre || ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.blueSoft }}>
                <View>
                  <Text style={{ fontSize: 13, color: C.blueInk }}>{L('Tipo de cambio de hoy', "Today's exchange rate")}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: C.blueInk }}>1 USD = {rate ? rate.toFixed(2) : '—'} MXN</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.blueInk, textAlign: 'right' }}>
                  {L('Actualizado', 'Updated')}
                  {'\n'}
                  {updated}
                </Text>
              </View>
              {ptsStore ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/puntos')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.goldSoft }}>
                  <Text style={{ fontSize: 14, color: C.goldInk, flex: 1 }} numberOfLines={1}>{L('Tus puntos en ', 'Your points at ') + ptsStore.nombre.replace('Castillo · ', '')}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.goldInk }}>{balance(ptsStore.id)} pts</Text>
                </Pressable>
              ) : profile?.member_code ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/tarjeta')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.goldSoft }}>
                  <Text style={{ fontSize: 14, color: C.goldInk }}>{L('Tu número de cliente', 'Your member number')}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.goldInk }}>{profile.member_code}</Text>
                </Pressable>
              ) : null}
            </View>

            {stories && (stories.length || (profile && profile.role !== 'cliente')) ? (
              <StoriesRow stories={stories} addHref={profile?.role === 'admin' ? '/admin/historias' : profile?.role === 'tienda' ? '/tienda/historias' : undefined} />
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

            {/* Enviar dinero */}
            {any('send') ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/enviar')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderRadius: 22, backgroundColor: C.brown }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900' }}>{L('Enviar dinero a México', 'Send money to Mexico')}</Text>
                  <Text style={{ color: C.goldSoft, fontSize: 14, marginTop: 4 }}>{L('Rápido, seguro y con comprobante', 'Fast, safe and with a receipt')}</Text>
                </View>
                <Circ n="arrow" tone="sun" size={52} />
              </Pressable>
            ) : null}

            {/* Accesos rápidos */}
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('¿Qué quieres hacer hoy?', 'What would you like to do today?')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {qa.map((a) => (
                <Pressable key={a.label} accessibilityRole="button" onPress={() => router.push(a.go as never)}
                  style={{ width: '31%', flexGrow: 1, minHeight: 100, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
                  <Circ n={a.ic} tone={a.tone} size={44} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink, textAlign: 'center' }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Promociones (abajo de los accesos rápidos) */}
            {promos.length ? <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('Promociones', 'Promotions')}</Text> : null}
            {promos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={292} decelerationRate="fast" contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingLeft: 16 }}>
                {promos.map((p) => (
                  <Pressable key={p.go + p.t} accessibilityRole="button" onPress={() => p.go && router.push(p.go as never)}
                    style={{ width: 282, minHeight: 118, borderRadius: 20, backgroundColor: p.bg, padding: 16, justifyContent: 'flex-end', overflow: 'hidden' }}>
                    {p.img ? (
                      <>
                        <Image source={{ uri: p.img }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,31,58,0.45)' }} />
                      </>
                    ) : (
                      <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.22 }}>
                        <Icon n={p.icon} size={110} color="#fff" sw={1.4} />
                      </View>
                    )}
                    <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', lineHeight: 22 }}>{p.t}</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{p.s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

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
            <Pressable accessibilityRole="button" onPress={() => router.push('/perfil')}
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
                {myStore ? <P small>{[myStore.direccion, myStore.ciudad].filter(Boolean).join(' · ')}{myStore.abierta === false ? ' · ' + L('Cerrada ahora', 'Closed now') : ''}</P> : null}
              </View>
              <Text style={{ fontWeight: '800', color: C.blue }}>{myStore ? L('Cambiar', 'Change') : L('Elegir', 'Choose')}</Text>
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
