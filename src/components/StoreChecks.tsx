/** Elegir una o varias sucursales con casillas (para cuentas de tienda y empleados). */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Icon, Label } from '@/components/ui';
import { storeShort } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Store } from '@/lib/types';

export function StoreChecks({ stores, value, onChange, label }: { stores: Store[]; value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const { L } = useLang();
  const all = stores.length > 0 && stores.every((s) => value.includes(s.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const chip = (on: boolean, text: string, onPress: () => void, key: string, strong = false) => (
    <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 38, borderRadius: R.pill, borderWidth: 1.5, borderColor: on ? C.brown : C.line2, backgroundColor: on ? C.tint : C.card }}>
      <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: on ? C.brown : C.line2, backgroundColor: on ? C.brown : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon n="check" size={12} color="#fff" sw={3} /> : null}
      </View>
      <Text style={{ fontWeight: strong ? '900' : '800', color: C.ink }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <Label>{label || L('Sucursales donde trabaja', 'Branches they work at')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stores.length > 1 ? chip(all, L('Todas', 'All'), () => onChange(all ? [] : stores.map((s) => s.id)), 'all', true) : null}
        {stores.map((s) => chip(value.includes(s.id), storeShort(s), () => toggle(s.id), s.id))}
      </View>
    </View>
  );
}

/** "Centro, Norte" o "Todas" para mostrar en listas. */
export function storesLabel(ids: string[] | null | undefined, stores: Store[], allLabel: string) {
  const list = (ids || []).map((id) => stores.find((s) => s.id === id)).filter(Boolean) as Store[];
  if (!list.length) return '';
  if (stores.length > 1 && list.length === stores.length) return allLabel;
  return list.map(storeShort).join(', ');
}
