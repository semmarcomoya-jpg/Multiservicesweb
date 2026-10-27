import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Wallpaper, type WallTheme } from '@/components/art';
import { Text, TextInput } from '@/components/Text';
import { useLang } from '@/lib/i18n';
import { ICONS } from '@/lib/icons';
import { C, R, STATUS_COLORS } from '@/lib/theme';

// ---------- Ícono
const SVG_TAGS: Record<string, React.ComponentType<any>> = { path: Path, rect: Rect, circle: Circle };
export function Icon({ n, size = 22, color = C.ink, sw = 2 }: { n: string; size?: number; color?: string; sw?: number }) {
  const def = ICONS[n] || ICONS.tool;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {def.map(([tag, props], i) => {
        const Tag = SVG_TAGS[tag];
        return Tag ? <Tag key={i} {...props} /> : null;
      })}
    </Svg>
  );
}

export function IcoBox({ n, size = 36, bg = C.icoBg, color = C.brown }: { n: string; size?: number; bg?: string; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon n={n} size={size * 0.52} color={color} />
    </View>
  );
}

/** Círculo de color con ícono (c-gold / c-blue de la maqueta) */
export function Circ({ n, tone = 'gold', size = 48 }: { n: string; tone?: 'gold' | 'blue' | 'white' | 'sun'; size?: number }) {
  const bg = { gold: C.goldSoft, blue: C.blueSoft, white: C.card, sun: C.gold }[tone];
  const fg = { gold: C.brown, blue: C.blue, white: C.brown, sun: C.ink }[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon n={n} size={Math.round(size * 0.46)} color={fg} sw={tone === 'sun' ? 2.4 : 2} />
    </View>
  );
}

export const MiniChip = ({ children, icon }: { children: React.ReactNode; icon?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.cream }}>
    {icon ? <Icon n={icon} size={12} color={C.softInk} /> : null}
    <Text style={{ fontSize: 11, fontWeight: '800', color: C.softInk }}>{children}</Text>
  </View>
);

export function BrandChip({ name = 'Castillo' }: { name?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.92)' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.goldSoft, fontWeight: '900', fontSize: 15 }}>C</Text>
      </View>
      <Text style={{ fontWeight: '800', fontSize: 14, color: C.ink }}>{name}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, me = true }: { name: string; size?: number; me?: boolean }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: me ? C.brown : C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '900', fontSize: size * 0.36, color: me ? C.goldSoft : C.goldInk }}>{ini || '·'}</Text>
    </View>
  );
}

// ---------- Texto
export const H1 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.h1, style]} accessibilityRole="header">
    {children}
  </Text>
);
export const H2 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.h2, style]} accessibilityRole="header">
    {children}
  </Text>
);
export const P = ({ children, muted, small, style }: { children: React.ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.p, muted && { color: C.muted }, small && { fontSize: 13 }, style]}>{children}</Text>
);
export const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.label}>{children}</Text>;

// ---------- Contenedores
export function Screen({
  children,
  scroll = true,
  wide = false,
  footer,
  bg = C.page,
  wall,
  flush = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  wide?: boolean;
  footer?: React.ReactNode;
  bg?: string;
  /** Fondo tipo WhatsApp del tema de la sección */
  wall?: WallTheme;
  /** Sin márgenes ni espacio arriba (para portadas) */
  flush?: boolean;
}) {
  const max = wide ? 1100 : 520;
  const inner = <View style={[s.inner, { maxWidth: max }, flush && { paddingHorizontal: 0, paddingTop: 0, gap: 0 }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: wall ? undefined : bg }} edges={flush ? ['left', 'right'] : ['top', 'left', 'right']}>
      {wall ? <Wallpaper theme={wall} /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? <View style={s.footer}><View style={[s.inner, { maxWidth: max, paddingVertical: 12, paddingBottom: 18 }]}>{footer}</View></View> : null}
    </SafeAreaView>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;
export const Row = ({ children, style, gap = 10 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>
);
export const Col = ({ children, style, gap = 12 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ gap }, style]}>{children}</View>
);

// ---------- Botones
type BtnKind = 'primary' | 'ghost' | 'danger' | 'blue' | 'soft';
export function Btn({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.brown, ghost: C.card, danger: C.card, blue: C.blue, soft: C.goldSoft }[kind];
  const fg = { primary: '#fff', ghost: C.ink, danger: C.red, blue: '#fff', soft: C.goldInk }[kind];
  const border = kind === 'ghost' ? C.line : kind === 'danger' ? C.redSoft : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSm,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon n={icon} size={small ? 16 : 19} color={fg} /> : null}
      <Text style={[s.btnTxt, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Pasos del trámite, como en la maqueta: Servicio · Pago · Listo */
export function Stepper({ steps, cur }: { steps: string[]; cur: number }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: cur + 1 }}>
      {steps.map((x, i) => (
        <View key={x} style={{ flex: 1, gap: 5 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= cur ? C.gold : C.line }} />
          <Text style={{ fontSize: 11, fontWeight: '800', color: i < cur ? C.brown : i === cur ? C.ink : '#8C6E5C' }}>{x}</Text>
        </View>
      ))}
    </View>
  );
}

export function BackBar({ title, right, steps, cur = 0 }: { title?: string; right?: React.ReactNode; steps?: string[]; cur?: number }) {
  const { L } = useLang();
  if (steps)
    return (
      <Row style={{ flexWrap: 'nowrap', paddingTop: 4 }} gap={8}>
        <Pressable accessibilityRole="button" accessibilityLabel={L('Regresar', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.backPlain}>
          <Icon n="back" size={24} color={C.ink} sw={2.4} />
        </Pressable>
        <Stepper steps={steps} cur={cur} />
      </Row>
    );
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={L('Regresar', 'Back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={s.back}
      >
        <Icon n="back" size={22} color={C.ink} />
      </Pressable>
      {title ? <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
      {right}
    </Row>
  );
}

// ---------- Formularios
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  secure,
  maxLength,
  multiline,
  hint,
  autoCapitalize,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 180 }, style]}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B59A88"
        keyboardType={keyboardType}
        secureTextEntry={secure}
        maxLength={maxLength}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[s.input, multiline && { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }, !!error && { borderColor: C.red }]}
      />
      {error ? <Text style={s.err}>{error}</Text> : hint ? <P small muted>{hint}</P> : null}
    </View>
  );
}

export function Pills<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { v: T; label: string; icon?: string; disabled?: boolean }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.v === value;
          return (
            <Pressable
              key={String(o.v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: !!o.disabled }}
              disabled={o.disabled}
              onPress={() => onChange(o.v)}
              style={[s.pill, on && s.pillOn, o.disabled && { opacity: 0.45 }]}
            >
              {o.icon ? <Icon n={o.icon} size={16} color={on ? C.brown : C.softInk} /> : null}
              <Text style={[s.pillTxt, on && { fontWeight: '800' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, sub, value, onChange, icon }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; icon?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[s.toggle, value && { borderColor: C.gold, backgroundColor: C.tint }]}
    >
      {icon ? <IcoBox n={icon} size={36} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: C.ink, fontSize: 15 }}>{label}</Text>
        {sub ? <P small muted>{sub}</P> : null}
      </View>
      <View style={[s.sw, value && { backgroundColor: C.gold }]}>
        <View style={[s.swDot, value && { transform: [{ translateX: 20 }] }]} />
      </View>
    </Pressable>
  );
}

// ---------- Avisos y chips
export function Note({ children, kind = 'gold', icon }: { children: React.ReactNode; kind?: 'gold' | 'blue' | 'red'; icon?: string }) {
  const bg = { gold: C.goldSoft, blue: C.blueSoft, red: C.redSoft }[kind];
  const fg = { gold: C.goldInk, blue: C.blueInk, red: C.red }[kind];
  return (
    <View style={[s.note, { backgroundColor: bg }]}>
      {icon ? <Icon n={icon} size={20} color={fg} /> : null}
      <Text style={{ flex: 1, color: fg, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function StatusChip({ status }: { status: string }) {
  const { L } = useLang();
  const c = STATUS_COLORS[status] || STATUS_COLORS.verificar;
  const label =
    { verificar: L('Pago por verificar', 'Checking payment'), proceso: L('En proceso', 'In progress'), completado: L('Completado', 'Done'), rechazado: L('Rechazado', 'Rejected') }[status] || status;
  return (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <View style={s.empty}>
    <Text style={{ color: C.muted, textAlign: 'center', fontWeight: '600' }}>{children}</Text>
  </View>
);

export const Loading = () => (
  <View style={{ padding: 40, alignItems: 'center' }}>
    <ActivityIndicator color={C.brown} />
  </View>
);

export function LangToggle({ glass = false }: { glass?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <View style={[s.seg, glass && { backgroundColor: 'rgba(255,255,255,0.85)' }]} accessibilityRole="radiogroup" accessibilityLabel="Idioma / Language">
      {(['es', 'en'] as const).map((l) => (
        <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: lang === l }} onPress={() => setLang(l)} style={[s.segBtn, lang === l && { backgroundColor: C.ink }]}>
          <Text style={{ fontWeight: '900', color: lang === l ? '#fff' : C.segInk }}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TopBar({ subtitle }: { subtitle?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingTop: 6 }}>
      <BrandChip />
      {subtitle ? <P small muted style={{ flex: 1 }}>{subtitle}</P> : null}
      <LangToggle glass />
    </Row>
  );
}

export const s = StyleSheet.create({
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  footer: { borderTopWidth: 1, borderTopColor: '#EFE8DD', backgroundColor: C.card },
  h1: { fontSize: 26, fontWeight: '900', color: C.ink, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '900', color: C.ink },
  p: { fontSize: 15, lineHeight: 22, color: C.softInk },
  label: { fontSize: 14, fontWeight: '800', color: C.ink },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: '#EFE8DD' },
  btn: { minHeight: 54, paddingHorizontal: 18, borderRadius: 16, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12 },
  btnTxt: { fontSize: 16, fontWeight: '800' },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: '#EFE8DD', alignItems: 'center', justifyContent: 'center' },
  backPlain: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 14, fontSize: 16, color: C.ink, fontWeight: '600' },
  err: { color: C.red, fontWeight: '700', fontSize: 13 },
  pill: { minHeight: 42, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillOn: { borderWidth: 2, borderColor: C.brown, backgroundColor: C.goldSoft },
  pillTxt: { fontWeight: '700', color: C.ink, fontSize: 14 },
  toggle: { flexGrow: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: C.cream },
  sw: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D9C8B8', padding: 3 },
  swDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: R.md, alignItems: 'flex-start' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, alignSelf: 'flex-start' },
  empty: { padding: 24, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: R.pill, backgroundColor: C.seg },
  segBtn: { minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' },
});
