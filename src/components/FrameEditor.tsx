/** Ajustar una foto: arrástrala para moverla (arriba, abajo, a los lados) y usa + / − para el zoom. */
import React, { useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, View } from 'react-native';

import { FRAME0, FramedImage } from '@/components/art';
import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { Frame } from '@/lib/types';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function FrameEditor({
  uri,
  frame,
  onChange,
  width,
  height,
  children,
}: {
  uri: string;
  frame?: Frame | null;
  onChange: (f: Frame) => void;
  width: number;
  height: number;
  /** Lo que va encima de la foto en la app (para ver cómo queda) */
  children?: React.ReactNode;
}) {
  const { L } = useLang();
  const f = { ...FRAME0, ...(frame || {}) };
  const cur = useRef(f);
  cur.current = f;
  const start = useRef(f);
  const [dragging, setDragging] = useState(false);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = cur.current;
        setDragging(true);
      },
      onPanResponderMove: (_e, g) => {
        const s = start.current;
        // Al arrastrar a la derecha se ve más de la izquierda de la foto
        onChange({ ...s, x: clamp(s.x - (g.dx / width) * 100 / s.z, 0, 100), y: clamp(s.y - (g.dy / height) * 100 / s.z, 0, 100) });
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  const zoom = (d: number) => onChange({ ...f, z: Math.round(clamp(f.z + d, 1, 3) * 10) / 10 });
  const nudge = (dx: number, dy: number) => onChange({ ...f, x: clamp(f.x + dx, 0, 100), y: clamp(f.y + dy, 0, 100) });
  const btn = (icon: React.ReactNode, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: C.line2, backgroundColor: pressed ? C.tint : C.card, alignItems: 'center', justifyContent: 'center' })}>
      {icon}
    </Pressable>
  );
  const sym = (t: string) => <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink, lineHeight: 22 }}>{t}</Text>;

  return (
    <View style={{ gap: 10, alignItems: 'flex-start' }}>
      <View
        {...pan.panHandlers}
        style={[
          { width, height, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: dragging ? C.brown : C.line, backgroundColor: C.tint },
          Platform.OS === 'web' ? ({ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' } as object) : null,
        ]}
      >
        <FramedImage uri={uri} frame={f} />
        {children}
        <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(11,31,58,0.65)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{L('Arrastra para acomodar', 'Drag to adjust')}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {btn(sym('−'), L('Alejar', 'Zoom out'), () => zoom(-0.1))}
        <Text style={{ minWidth: 46, textAlign: 'center', fontWeight: '800', color: C.ink }}>{Math.round(f.z * 100)}%</Text>
        {btn(sym('+'), L('Acercar', 'Zoom in'), () => zoom(0.1))}
        <View style={{ width: 10 }} />
        {btn(<Icon n="back" size={18} />, L('Izquierda', 'Left'), () => nudge(-5, 0))}
        {btn(<View style={{ transform: [{ rotate: '90deg' }] }}><Icon n="back" size={18} /></View>, L('Arriba', 'Up'), () => nudge(0, -5))}
        {btn(<View style={{ transform: [{ rotate: '-90deg' }] }}><Icon n="back" size={18} /></View>, L('Abajo', 'Down'), () => nudge(0, 5))}
        {btn(<View style={{ transform: [{ rotate: '180deg' }] }}><Icon n="back" size={18} /></View>, L('Derecha', 'Right'), () => nudge(5, 0))}
        <Pressable onPress={() => onChange(FRAME0)} style={{ paddingHorizontal: 12, height: 38, justifyContent: 'center' }}>
          <Text style={{ color: C.blue, fontWeight: '800' }}>{L('Centrar', 'Reset')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
