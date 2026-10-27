/** Estrellas: para mostrar una calificación o para elegirla. */
import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const GOLD = '#F5A524';

export function Star({ on, size = 16, half = false }: { on: boolean; size?: number; half?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR} fill={on ? GOLD : 'none'} stroke={on || half ? GOLD : C.line2} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} on={i <= Math.round(value)} size={size} />
      ))}
    </View>
  );
}

export function StarPicker({ value, onChange, size = 36 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const { L } = useLang();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={L('Calificación', 'Rating')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: value === i }} accessibilityLabel={`${i} ${L('estrellas', 'stars')}`} onPress={() => onChange(i)} hitSlop={4}>
          <Star on={i <= value} size={size} />
        </Pressable>
      ))}
    </View>
  );
}
