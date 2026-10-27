/** Fila "Destacados" de Inicio: productos y servicios, se recorre a la derecha. */
import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { IcoBox } from '@/components/ui';
import { prodFrom, prodName, svcCatIcon, useCategories } from '@/lib/data';
import type { FeaturedItem } from '@/lib/featured';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

export function Destacados({ items }: { items: FeaturedItem[] }) {
  const { L, nm } = useLang();
  const { data: cats } = useCategories();
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>{L('Destacados', 'Featured')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {items.map((it) => {
          const isP = it.kind === 'product';
          const title = isP ? prodName(it.product) : nm(it.service);
          const price = isP
            ? L('Desde ', 'From ') + money(prodFrom(it.product))
            : it.service.price_type === 'fixed'
              ? money(it.service.base)
              : it.service.price_type === 'options'
                ? L('Desde ', 'From ') + money(Math.min(...(it.service.options || []).map((o) => Number(o.p) || 0)))
                : L('Tú eliges el monto', 'You choose');
          return (
            <Pressable
              key={it.kind + it.ref_id}
              accessibilityRole="button"
              onPress={() => router.push(isP ? { pathname: '/producto/[id]', params: { id: it.ref_id } } : { pathname: '/servicio/[id]', params: { id: it.ref_id } })}
              style={({ pressed }) => ({ width: 150, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 10, gap: 6, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ height: 92, borderRadius: R.md, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {isP && it.product.foto_url ? (
                  <Image source={{ uri: it.product.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <IcoBox n={isP ? 'phone' : svcCatIcon(cats || [], it.service)} size={50} />
                )}
                {it.hot ? (
                  <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: C.ink }}>{L('Lo más pedido', 'Top pick')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 13 }} numberOfLines={2}>{title}</Text>
              <Text style={{ fontWeight: '900', color: C.brownDark, fontSize: 13 }} numberOfLines={1}>{price}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
