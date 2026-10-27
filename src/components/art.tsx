import React, { useId } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

import { useBranding } from '@/lib/branding';
import { ICONS } from '@/lib/icons';
import type { Frame, WallCfg } from '@/lib/types';

// ---------- Fondos tipo WhatsApp: íconos del tema repetidos con poca opacidad
export type WallTheme = 'home' | 'send' | 'shop' | 'pts' | 'profile' | 'community';

export const WALL_THEMES: Record<WallTheme, { icons: string[]; color: string }> = {
  home: { icons: ['send', 'star', 'phone', 'gift', 'home', 'cash'], color: '#EEF5FD' },
  send: { icons: ['send', 'cash', 'heart', 'bank', 'users', 'arrow'], color: '#ECF3FC' },
  shop: { icons: ['phone', 'bag', 'cart', 'headphones', 'gift', 'sim'], color: '#F1F6FD' },
  pts: { icons: ['star', 'gift', 'heart', 'star', 'gift', 'check'], color: '#EDF6FE' },
  profile: { icons: ['user', 'id', 'shield', 'lock', 'home', 'store'], color: '#F0F4FB' },
  community: { icons: ['chat', 'heart', 'thumb', 'users', 'star', 'home'], color: '#EDF2FB' },
};

const SPOTS: [number, number, number][] = [
  [18, 14, -12], [118, 22, 10], [64, 70, 18], [168, 86, -8], [20, 124, 6], [110, 140, -16], [176, 178, 14], [56, 186, -4], [140, 92, 30],
];
const TAGS: Record<string, React.ComponentType<any>> = { path: Path, rect: Rect, circle: Circle };

export function Wallpaper({ theme = 'home', override }: { theme?: WallTheme; override?: WallCfg }) {
  const id = 'wall' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const { brand } = useBranding();
  const cfg = override || brand.walls?.[theme];
  const t = { ...(WALL_THEMES[theme] || WALL_THEMES.home), ...(cfg?.color ? { color: cfg.color } : {}) };
  if (cfg?.mode === 'color') return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color }]} />;
  if (cfg?.mode === 'image' && cfg.img)
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color }]}>
        <Image source={{ uri: cfg.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(245,249,254,0.82)' }]} />
      </View>
    );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} x="0" y="0" width="220" height="220" patternUnits="userSpaceOnUse">
            <G fill="none" stroke="#1656A8" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.16}>
              {SPOTS.map(([x, y, r], i) => {
                const ic = ICONS[t.icons[i % t.icons.length]] || ICONS.star;
                return (
                  <G key={i} transform={`translate(${x} ${y}) rotate(${r} 12 12) scale(1.15)`}>
                    {ic.map(([tag, props], j) => {
                      const Tag = TAGS[tag];
                      return Tag ? <Tag key={j} {...props} /> : null;
                    })}
                  </G>
                );
              })}
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// ---------- Paisaje de portada: papel picado, sol, cerros y casita (igual que la maqueta)
const FLAGS: [number, number, number, string][] = [
  [0, 70, 75, '#62BDF6'], [55, 80, 87, '#2A8BDA'], [110, 89, 93, '#FFFFFF'], [165, 94, 94, '#1656A8'], [220, 93, 89, '#62BDF6'], [275, 87, 80, '#2A8BDA'], [330, 75, 70, '#FFFFFF'],
];

export function Scenery({ mid = false }: { mid?: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 460" preserveAspectRatio={mid ? 'xMidYMid slice' : 'xMidYMax slice'} style={StyleSheet.absoluteFill}>
      <Rect width="390" height="460" fill="#D3E7FA" />
      <Circle cx="296" cy="168" r="52" fill="#FFFFFF" />
      <Path d="M0 300 C 80 240, 160 250, 230 290 S 340 260, 390 280 L390 460 L0 460Z" fill="#9DCBF3" />
      <Path d="M0 352 C 90 302, 180 332, 260 342 S 360 322, 390 332 L390 460 L0 460Z" fill="#4D99E0" />
      <Rect x="196" y="318" width="54" height="36" rx="2" fill="#F5F9FE" />
      <Path d="M190 320 L223 296 L256 320Z" fill="#0B2E5E" />
      <Rect x="217" y="334" width="12" height="20" fill="#1656A8" />
      <Path d="M0 402 C 100 372, 220 382, 390 397 L390 460 L0 460Z" fill="#1656A8" />
      <Path d="M-10 64 Q 195 124 400 64" fill="none" stroke="#5B7DA8" strokeWidth={2} />
      {FLAGS.map(([x, a, b, color], i) => {
        const d = `M${x} ${a} L${x + 40} ${b} L${x + 40} ${b + 40} L${x + 32} ${b + 46} L${x + 24} ${b + 40} L${x + 16} ${a + 46} L${x + 8} ${a + 40} L${x} ${a + 46}Z`;
        return (
          <G key={i}>
            <Path d={d} fill={color} />
            <Circle cx={x + 20} cy={(a + b) / 2 + 22} r="6" fill="#D3E7FA" />
          </G>
        );
      })}
    </Svg>
  );
}

// ---------- Foto con encuadre (posición y zoom) que el administrador ajusta
export const FRAME0: Frame = { x: 50, y: 50, z: 1 };
export function FramedImage({ uri, frame }: { uri: string; frame?: Frame | null }) {
  const f = { ...FRAME0, ...(frame || {}) };
  if (Platform.OS === 'web')
    return React.createElement('img', {
      src: uri,
      alt: '',
      draggable: false,
      style: {
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        objectPosition: `${f.x}% ${f.y}%`, transform: `scale(${f.z})`, transformOrigin: `${f.x}% ${f.y}%`,
        userSelect: 'none', pointerEvents: 'none',
      },
    });
  return <Image source={{ uri }} style={[StyleSheet.absoluteFill, { transform: [{ scale: f.z }] }]} resizeMode="cover" />;
}
