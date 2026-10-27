import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Empty, H1, IcoBox, Loading, P, Pills, Screen, TopBar } from '@/components/ui';
import { storesForService, svcCatIcon, useCategories, useServices, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Service } from '@/lib/types';

export default function Servicios() {
  const { L, nm, lang } = useLang();
  const { data: cats } = useCategories();
  const { data: services, loading } = useServices();
  const { data: stores } = useStores();
  const [cat, setCat] = useState<string>('all');

  const avail = (services || []).filter((sv) => sv.activo && storesForService(stores || [], sv).length > 0);
  const list = avail.filter((sv) => cat === 'all' || sv.cat_id === cat);
  const usedCats = (cats || []).filter((c) => avail.some((sv) => sv.cat_id === c.id));

  const price = (sv: Service) =>
    sv.price_type === 'fixed'
      ? money(sv.base)
      : sv.price_type === 'options'
        ? L('Desde ', 'From ') + money(Math.min(...(sv.options || []).map((o) => Number(o.p) || 0)))
        : L('Tú eliges el monto', 'You choose the amount');

  return (
    <Screen>
      <TopBar />
      <H1>{L('Servicios', 'Services')}</H1>
      <P muted>{L('Elige un servicio y dinos cómo lo quieres: sin salir de casa, en tienda, sin bajar del carro o a domicilio.', 'Pick a service and tell us how you want it: from home, in store, curbside or delivered.')}</P>
      <Pills
        options={[{ v: 'all', label: L('Todos', 'All') }, ...usedCats.map((c) => ({ v: c.id, label: nm(c), icon: c.icon }))]}
        value={cat}
        onChange={setCat}
      />
      {loading ? <Loading /> : null}
      {!loading && list.length === 0 ? <Empty>{L('No hay servicios disponibles por ahora.', 'No services available right now.')}</Empty> : null}
      {list.map((sv) => (
        <Pressable
          key={sv.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/servicio/[id]', params: { id: sv.id } })}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}
        >
          <IcoBox n={svcCatIcon(cats || [], sv)} size={46} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{nm(sv)}</Text>
            <P small muted>{lang === 'es' ? sv.desc_es : sv.desc_en}</P>
            <Text style={{ fontWeight: '800', color: C.brownDark, fontSize: 13, marginTop: 2 }}>
              {price(sv)}
              {(lang === 'es' ? sv.eta_es : sv.eta_en) ? ' · ' + (lang === 'es' ? sv.eta_es : sv.eta_en) : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
