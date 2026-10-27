import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardTypeOptions,
  Platform,
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
import { useBranding } from '@/lib/branding';
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

export function BrandChip({ full = false }: { full?: boolean; name?: string }) {
  const { brand } = useBranding();
  const name = full ? brand.nombre : brand.corto || brand.nombre;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.92)' }}>
      <BrandMark size={30} />
      <Text style={{ fontWeight: '800', fontSize: 14, color: C.ink }}>{name}</Text>
    </View>
  );
}

/** Logo de la marca (o su inicial en el círculo café). */
export function BrandMark({ size = 30, square = false }: { size?: number; square?: boolean }) {
  const { brand } = useBranding();
  const r = square ? size * 0.3 : size / 2;
  if (brand.logo_url) return <Image source={{ uri: brand.logo_url }} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.goldSoft, fontWeight: '900', fontSize: size * 0.5 }}>{(brand.nombre || 'C').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, me = true, uri }: { name: string; size?: number; me?: boolean; uri?: string | null }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.tint }} />;
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
          <Text style={{ fontSize: 11, fontWeight: '800', color: i < cur ? C.brown : i === cur ? C.ink : '#687B94' }}>{x}</Text>
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
        placeholderTextColor="#93A5BD"
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

/** Filtros y pestañas como en Viva: una sola fila que se recorre a la derecha;
 *  la opción elegida se queda a la vista. En compu, la rueda del mouse también la recorre. */
export function ChipScroll({ children, active, style }: { children: React.ReactNode; active?: string | number | null; style?: StyleProp<ViewStyle> }) {
  const ref = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const xs = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const x = active == null ? undefined : xs.current[String(active)];
    if (x !== undefined && x > 40) ref.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [active]);
  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = (ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const before = node.scrollLeft;
      node.scrollLeft += e.deltaY;
      if (node.scrollLeft !== before) e.preventDefault();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);
  const kids = React.Children.toArray(children);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0 }, style]} contentContainerStyle={{ gap: 8, paddingLeft: 2, paddingRight: 16, paddingVertical: 2, alignItems: 'center' }}>
      {kids.map((k) => {
        const key = React.isValidElement(k) && k.key != null ? String(k.key).replace(/^\.\$/, '') : '';
        return (
          <View key={key} onLayout={(e) => { xs.current[key] = e.nativeEvent.layout.x; }}>
            {k}
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * Opciones para elegir una.
 *  - Filtros (sin etiqueta): una fila que se recorre a la derecha, como en Viva.
 *  - Opciones de un formulario (con etiqueta, o `wrap`): se acomodan en varias líneas
 *    para que ninguna quede cortada (variantes, precios, montos, horarios…).
 */
export function Pills<T extends string | number>({
  options,
  value,
  onChange,
  label,
  wrap,
}: {
  options: { v: T; label: string; icon?: string; img?: string | null; disabled?: boolean }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  label?: string;
  wrap?: boolean;
}) {
  const multi = wrap ?? !!label;
  const items = options.map((o) => {
    const on = o.v === value;
    return (
      <Pressable
        key={String(o.v)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on, disabled: !!o.disabled }}
        disabled={o.disabled}
        onPress={() => onChange(o.v)}
        style={({ pressed }) => [s.pill, multi && { maxWidth: '100%', flexShrink: 1 }, on && s.pillOn, o.disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
      >
        {o.img ? <Image source={{ uri: o.img }} style={{ width: 26, height: 26, borderRadius: 13, marginLeft: -6, backgroundColor: C.tint }} /> : o.icon ? <Icon n={o.icon} size={16} color={on ? '#fff' : C.softInk} /> : null}
        <Text style={[s.pillTxt, multi && ({ whiteSpace: 'normal', flexShrink: 1 } as TextStyle), on && { fontWeight: '800', color: '#fff' }]}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {items}
        </View>
      ) : (
        <ChipScroll active={value == null ? null : String(value)}>{items}</ChipScroll>
      )}
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
    { verificar: L('Pago por confirmar', 'Payment pending'), proceso: L('En proceso', 'In progress'), completado: L('Completado', 'Done'), rechazado: L('Rechazado', 'Rejected') }[status] || status;
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
  footer: { borderTopWidth: 1, borderTopColor: '#E1E9F3', backgroundColor: C.card },
  h1: { fontSize: 26, fontWeight: '900', color: C.ink, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '900', color: C.ink },
  p: { fontSize: 15, lineHeight: 22, color: C.softInk },
  label: { fontSize: 14, fontWeight: '800', color: C.ink },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E1E9F3' },
  btn: { minHeight: 54, paddingHorizontal: 18, borderRadius: 16, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12 },
  btnTxt: { fontSize: 16, fontWeight: '800' },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: '#E1E9F3', alignItems: 'center', justifyContent: 'center' },
  backPlain: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 14, fontSize: 16, color: C.ink, fontWeight: '600' },
  err: { color: C.red, fontWeight: '700', fontSize: 13 },
  pill: { minHeight: 42, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillOn: { borderColor: C.brown, backgroundColor: C.brown },
  pillTxt: { fontWeight: '700', color: C.ink, fontSize: 14, whiteSpace: 'nowrap' } as TextStyle,
  toggle: { flexGrow: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: C.cream },
  sw: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#C8D4E4', padding: 3 },
  swDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: R.md, alignItems: 'flex-start' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, alignSelf: 'flex-start' },
  empty: { padding: 24, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: R.pill, backgroundColor: C.seg },
  segBtn: { minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' },
});

/** Quita acentos y mayúsculas para buscar: "telefono" encuentra "Teléfono". */
export const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** ¿Todas las palabras de la búsqueda aparecen en alguno de los campos? */
export function matches(q: string, ...fields: unknown[]) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map(norm).join(' ');
  return words.every((w) => hay.includes(w));
}

/** Buscador con lupita (y botón para borrar). */
export function SearchBox({ value, onChangeText, placeholder, count }: { value: string; onChangeText: (v: string) => void; placeholder?: string; count?: number }) {
  const { L } = useLang();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: R.pill, borderWidth: 1.5, borderColor: value ? C.brown : C.line2, backgroundColor: C.card, paddingLeft: 16, paddingRight: 6 }}>
        <Icon n="search" size={20} color={value ? C.brown : C.muted} />
        <TextInput
          accessibilityLabel={L('Buscar', 'Search')}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || L('Buscar…', 'Search…')}
          placeholderTextColor="#93A5BD"
          autoCorrect={false}
          returnKeyType="search"
          style={[{ flex: 1, minWidth: 0, fontSize: 16, color: C.ink, paddingVertical: 10 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={L('Borrar búsqueda', 'Clear search')} onPress={() => onChangeText('')} hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="x" size={16} color={C.ink} />
          </Pressable>
        ) : null}
      </View>
      {value && count !== undefined ? <P small muted style={{ paddingLeft: 16 }}>{count === 0 ? L('Sin resultados', 'No results') : L(`${count} resultado${count === 1 ? '' : 's'}`, `${count} result${count === 1 ? '' : 's'}`)}</P> : null}
    </View>
  );
}
