import React, { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

import { useBranding } from '@/lib/branding';
import { ICONS } from '@/lib/icons';
import type { WallCfg } from '@/lib/types';

// ---------- Fondos tipo WhatsApp: íconos del tema repetidos con poca opacidad
export type WallTheme = 'home' | 'send' | 'shop' | 'pts' | 'profile' | 'community';

export const WALL_THEMES: Record<WallTheme, { icons: string[]; color: string }> = {
  home: { icons: ['send', 'star', 'phone', 'gift', 'home', 'cash'], color: '#FFF3E6' },
  send: { icons: ['send', 'cash', 'heart', 'bank', 'users', 'arrow'], color: '#FFF1E2' },
  shop: { icons: ['phone', 'bag', 'cart', 'headphones', 'gift', 'sim'], color: '#FFF4EA' },
  pts: { icons: ['star', 'gift', 'heart', 'star', 'gift', 'check'], color: '#FFF6E0' },
  profile: { icons: ['user', 'id', 'shield', 'lock', 'home', 'store'], color: '#FDF2EA' },
  community: { icons: ['chat', 'heart', 'thumb', 'users', 'star', 'home'], color: '#FFF0E4' },
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
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,247,240,0.80)' }]} />
      </View>
    );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} x="0" y="0" width="220" height="220" patternUnits="userSpaceOnUse">
            <G fill="none" stroke="#B84E17" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.16}>
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
  [0, 70, 75, '#F2A541'], [55, 80, 87, '#1F6F78'], [110, 89, 93, '#FFFFFF'], [165, 94, 94, '#E0582A'], [220, 93, 89, '#F2A541'], [275, 87, 80, '#1F6F78'], [330, 75, 70, '#FFFFFF'],
];

export function Scenery({ mid = false }: { mid?: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 460" preserveAspectRatio={mid ? 'xMidYMid slice' : 'xMidYMax slice'} style={StyleSheet.absoluteFill}>
      <Rect width="390" height="460" fill="#FFE1C4" />
      <Circle cx="296" cy="168" r="52" fill="#FFC56B" />
      <Path d="M0 300 C 80 240, 160 250, 230 290 S 340 260, 390 280 L390 460 L0 460Z" fill="#F6B98A" />
      <Path d="M0 352 C 90 302, 180 332, 260 342 S 360 322, 390 332 L390 460 L0 460Z" fill="#E8884E" />
      <Rect x="196" y="318" width="54" height="36" rx="2" fill="#FFF7F0" />
      <Path d="M190 320 L223 296 L256 320Z" fill="#C4451C" />
      <Rect x="217" y="334" width="12" height="20" fill="#B84E17" />
      <Path d="M0 402 C 100 372, 220 382, 390 397 L390 460 L0 460Z" fill="#B84E17" />
      <Path d="M-10 64 Q 195 124 400 64" fill="none" stroke="#A0613A" strokeWidth={2} />
      {FLAGS.map(([x, a, b, color], i) => {
        const d = `M${x} ${a} L${x + 40} ${b} L${x + 40} ${b + 40} L${x + 32} ${b + 46} L${x + 24} ${b + 40} L${x + 16} ${a + 46} L${x + 8} ${a + 40} L${x} ${a + 46}Z`;
        return (
          <G key={i}>
            <Path d={d} fill={color} />
            <Circle cx={x + 20} cy={(a + b) / 2 + 22} r="6" fill="#FFE1C4" />
          </G>
        );
      })}
    </Svg>
  );
}
