import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
}: {
  children: React.ReactNode;
  scroll?: boolean;
  wide?: boolean;
  footer?: React.ReactNode;
  bg?: string;
}) {
  const inner = <View style={[s.inner, { maxWidth: wide ? 1100 : 560 }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? <View style={s.footer}><View style={[s.inner, { maxWidth: wide ? 1100 : 560, paddingVertical: 12 }]}>{footer}</View></View> : null}
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
  const border = kind === 'ghost' ? C.line2 : kind === 'danger' ? C.red : bg;
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

export function BackBar({ title, right }: { title?: string; right?: React.ReactNode }) {
  const { L } = useLang();
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
              {o.icon ? <Icon n={o.icon} size={16} color={on ? C.brownDark : C.softInk} /> : null}
              <Text style={[s.pillTxt, on && { color: C.brownDark }]}>{o.label}</Text>
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
      <Text style={{ flex: 1, color: fg, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{children}</Text>
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

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel="Idioma / Language">
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
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <Row gap={10}>
        <View style={s.logo}>
          <Text style={{ color: C.goldSoft, fontWeight: '900', fontSize: 20 }}>C</Text>
        </View>
        <View>
          <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>Castillo</Text>
          {subtitle ? <P small muted>{subtitle}</P> : null}
        </View>
      </Row>
      <LangToggle />
    </Row>
  );
}

export const s = StyleSheet.create({
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  footer: { borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card },
  h1: { fontSize: 26, fontWeight: '900', color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '900', color: C.ink },
  p: { fontSize: 15, lineHeight: 21, color: C.ink },
  label: { fontSize: 14, fontWeight: '800', color: C.ink },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: C.line },
  btn: { minHeight: 50, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { minHeight: 40, paddingHorizontal: 14 },
  btnTxt: { fontSize: 16, fontWeight: '900' },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 14, fontSize: 16, color: C.ink },
  err: { color: C.red, fontWeight: '700', fontSize: 13 },
  pill: { minHeight: 42, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.line2, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillOn: { borderColor: C.brown, backgroundColor: C.tint },
  pillTxt: { fontWeight: '800', color: C.softInk, fontSize: 14 },
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
