/** Fila de historias en Inicio, como en Instagram: círculos con aro de color si no se han visto. */
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { useLang } from '@/lib/i18n';
import { orderForViewer, useSeenStories } from '@/lib/stories';
import { C } from '@/lib/theme';
import type { Story } from '@/lib/types';

const SIZE = 68;

export function StoriesRow({ stories, addHref }: { stories: Story[]; addHref?: string }) {
  const { L, lang } = useLang();
  const seen = useSeenStories();
  const ordered = useMemo(() => orderForViewer(stories, seen), [stories, seen]);
  if (!ordered.length && !addHref) return null;
  // Dentro del teléfono del panel (iframe), el panel se abre en la ventana completa
  const goAdd = () => {
    if (!addHref) return;
    if (typeof window !== 'undefined' && window.self !== window.top) {
      const base = window.location.pathname.replace(/\/inicio.*$/, '');
      window.top!.location.href = window.location.origin + base + addHref;
    } else router.push(addHref as never);
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('Novedades', "What's new")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
        {addHref ? (
          <Pressable accessibilityRole="button" accessibilityLabel={L('Subir historia', 'Add story')} onPress={goAdd}
            style={({ pressed }) => ({ width: SIZE + 8, alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.brown, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.brown, fontSize: 34, fontWeight: '900', lineHeight: 38 }}>+</Text>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: C.brown, maxWidth: SIZE + 8 }}>{L('Subir', 'Add')}</Text>
          </Pressable>
        ) : null}
        {ordered.map((s) => {
          const isNew = !seen.has(s.id);
          const cap = (lang === 'es' ? s.caption_es || s.caption_en : s.caption_en || s.caption_es) || L('Ver', 'View');
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={L('Abrir historia: ', 'Open story: ') + cap}
              onPress={() => router.push({ pathname: '/historias', params: { id: s.id } })}
              style={({ pressed }) => ({ width: SIZE + 8, alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, padding: 3, backgroundColor: isNew ? C.brown : C.line2, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: SIZE + 2, height: SIZE + 2, borderRadius: (SIZE + 2) / 2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                  {s.media_type === 'image' ? (
                    <Image source={{ uri: s.media_url }} style={{ width: SIZE - 2, height: SIZE - 2, borderRadius: (SIZE - 2) / 2 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: SIZE - 2, height: SIZE - 2, borderRadius: (SIZE - 2) / 2, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 22 }}>▶</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: isNew ? '800' : '600', color: isNew ? C.ink : C.muted, maxWidth: SIZE + 8 }}>
                {cap}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
