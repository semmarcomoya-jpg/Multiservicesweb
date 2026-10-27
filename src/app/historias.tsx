/**
 * Visor de historias a pantalla completa (/historias?id=...), igual que en Viva.
 * Toques: derecha = siguiente, izquierda = anterior, mantener = pausa.
 * Fotos 5 s; videos lo que dure el video. Al acabar la última se cierra.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryVideo } from '@/components/StoryVideo';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { cachedStories, countView, fetchStories, IMAGE_STORY_MS, markStorySeen, orderForViewer, useSeenStories } from '@/lib/stories';
import { C } from '@/lib/theme';
import type { Story } from '@/lib/types';

export default function StoriesViewer() {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [fade]);
  return (
    <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: '#000' }}>
      <Content />
    </Animated.View>
  );
}

function Content() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { L, lang } = useLang();
  const insets = useSafeAreaInsets();
  const seen = useSeenStories();

  const initial = useMemo(() => {
    const list = cachedStories();
    if (!list) return null;
    const ordered = orderForViewer(list, seen);
    const start = ordered.findIndex((s) => s.id === id);
    return { ordered, start: start === -1 ? 0 : start };
    // Solo al abrir: reordenar mientras se ven las movería de lugar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stories, setStories] = useState<Story[] | null>(initial?.ordered ?? null);
  const [index, setIndex] = useState(initial?.start ?? 0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const fixed = useRef(initial !== null);

  useEffect(() => {
    if (fixed.current) return;
    void fetchStories().then((list) => {
      if (fixed.current) return;
      fixed.current = true;
      const ordered = orderForViewer(list, seen);
      setStories(ordered);
      const start = ordered.findIndex((s) => s.id === id);
      setIndex(start === -1 ? 0 : start);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const current = stories?.[index] ?? null;
  const loaded = !current || current.media_type !== 'image' || loadedId === current.id;

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const next = useCallback(() => {
    setProgress(0);
    setIndex((i) => {
      if (!stories || i + 1 >= stories.length) {
        close();
        return i;
      }
      return i + 1;
    });
  }, [close, stories]);

  const prev = useCallback(() => {
    setProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Se marca como vista, se cuenta y se precarga la siguiente
  useEffect(() => {
    if (!current) return;
    markStorySeen(current.id);
    void countView(current.id);
    const nx = stories?.[index + 1];
    if (nx?.media_type === 'image') Image.prefetch(nx.media_url).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Reloj de las fotos (no corre hasta que la foto ya se ve)
  useEffect(() => {
    if (!current || current.media_type !== 'image' || paused || !loaded) return undefined;
    const startedAt = Date.now() - progress * IMAGE_STORY_MS;
    const timer = setInterval(() => {
      const f = (Date.now() - startedAt) / IMAGE_STORY_MS;
      if (f >= 1) {
        clearInterval(timer);
        next();
      } else setProgress(f);
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, paused, loaded, next]);

  if (!stories) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!current) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{L('No hay historias por ahora.', 'No stories right now.')}</Text>
        <Pressable onPress={close} style={{ backgroundColor: C.brown, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{L('Cerrar', 'Close')}</Text>
        </Pressable>
      </View>
    );
  }

  const caption = lang === 'es' ? current.caption_es || current.caption_en : current.caption_en || current.caption_es;
  const cta: { label: string; icon: string; go: () => void } | null =
    current.link_type === 'product' && current.link_id
      ? { label: L('Lo quiero', 'I want it'), icon: 'bag', go: () => router.push({ pathname: '/producto/[id]', params: { id: current.link_id! } }) }
      : current.link_type === 'service' && current.link_id
        ? { label: L('Pedir servicio', 'Request service'), icon: 'tool', go: () => router.push({ pathname: '/servicio/[id]', params: { id: current.link_id! } }) }
        : current.link_type === 'send'
          ? { label: L('Enviar dinero', 'Send money'), icon: 'send', go: () => router.push('/enviar') }
          : current.link_type === 'shop'
            ? { label: L('Ver la tienda', 'See the shop'), icon: 'bag', go: () => router.push('/productos') }
            : null;

  const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[fill, { alignItems: 'center', justifyContent: 'center' }]}>
        {current.media_type === 'image' ? (
          <Image
            key={current.id}
            source={{ uri: current.media_url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
            onLoad={() => setLoadedId(current.id)}
            onError={() => setLoadedId(current.id)}
          />
        ) : (
          <StoryVideo uri={current.media_url} paused={paused} onProgress={setProgress} onEnd={next} />
        )}
      </View>

      {!loaded ? (
        <View style={[fill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}

      {/* Zonas de toque: izquierda atrás, derecha adelante, mantener pausa */}
      <View style={[fill, { flexDirection: 'row' }]}>
        <Pressable accessibilityLabel={L('Anterior', 'Previous')} style={{ width: '33%', height: '100%' }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        <Pressable accessibilityLabel={L('Siguiente', 'Next')} style={{ flex: 1, height: '100%' }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 10, paddingTop: insets.top + 8, gap: 10 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {stories.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <View style={{ height: 3, backgroundColor: '#fff', width: `${i < index ? 100 : i === index ? Math.round(progress * 100) : 0}%` }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.goldSoft, fontWeight: '900' }}>C</Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>Castillo Multiservices</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Cerrar', 'Close')} onPress={close} hitSlop={12}>
            <Icon n="x" size={28} color="#fff" sw={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, gap: 12, alignItems: 'center' }} pointerEvents="box-none">
        {caption ? (
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 }}>{caption}</Text>
        ) : null}
        {cta ? (
          <Pressable accessibilityRole="button" onPress={cta.go} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brown, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999, opacity: pressed ? 0.8 : 1 })}>
            <Icon n={cta.icon} size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{cta.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
