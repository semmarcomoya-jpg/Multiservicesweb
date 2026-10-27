import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { Circ, Empty, H1, Loading, MiniChip, P, Pills, Screen, TopBar, SearchBox, matches } from '@/components/ui';
import { useOrderText } from '@/components/orders';
import { storesForService, svcCatIcon, useCategories, useServices, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Service } from '@/lib/types';

const MODE_ICON: Record<string, string> = { digital: 'home', store: 'store', curb: 'car', home: 'truck' };

export default function Servicios() {
  const { L, nm, lang } = useLang();
  const { data: cats } = useCategories();
  const { data: services, loading } = useServices();
  const { data: stores } = useStores();
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const { modeLabel } = useOrderText();

  const avail = (services || []).filter((sv) => sv.activo && storesForService(stores || [], sv).length > 0);
  const list = avail.filter((sv) => (cat === 'all' || sv.cat_id === cat) && matches(q, sv.es, sv.en, sv.desc_es, sv.desc_en));
  const usedCats = (cats || []).filter((c) => avail.some((sv) => sv.cat_id === c.id));

  const price = (sv: Service) =>
    sv.price_type === 'fixed'
      ? money(sv.base)
      : sv.price_type === 'options'
        ? L('Desde ', 'From ') + money(Math.min(...(sv.options || []).map((o) => Number(o.p) || 0)))
        : L('Tú eliges el monto', 'You choose the amount');

  return (
    <Screen wall="shop">
      <TopBar />
      <H1>{L('Servicios', 'Services')}</H1>
      <P muted>{L('Elige un servicio y dinos cómo lo quieres: sin salir de casa, en tienda, sin bajar del carro o a domicilio.', 'Pick a service and tell us how you want it: from home, in store, curbside or delivered.')}</P>
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca: luz, recarga, Telcel…', 'Search: power, top-up, Telcel…')} count={list.length} />
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
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}
        >
          <Circ n={svcCatIcon(cats || [], sv)} size={48} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: C.ink }}>{nm(sv)}</Text>
            <P small>{lang === 'es' ? sv.desc_es : sv.desc_en}</P>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <MiniChip>{price(sv)}</MiniChip>
              {(lang === 'es' ? sv.eta_es : sv.eta_en) ? <MiniChip icon="clock">{lang === 'es' ? sv.eta_es : sv.eta_en}</MiniChip> : null}
              {(sv.modes || []).map((m) => (
                <MiniChip key={m} icon={MODE_ICON[m]}>{modeLabel(m)}</MiniChip>
              ))}
            </View>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
