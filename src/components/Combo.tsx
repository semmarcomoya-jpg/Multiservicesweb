/**
 * Lista desplegable con buscador (combo box). Sirve para listas cortas y largas (2,000+ municipios):
 * se escribe para filtrar, se puede limitar por grupo (por ejemplo continente) y, si se permite,
 * usar lo que se escribió cuando no está en la lista.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Icon, Label } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

export interface ComboOpt<T extends string | number = string> { v: T; label: string; sub?: string; group?: string; left?: string; disabled?: boolean }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Combo<T extends string | number>({
  label, value, options, onChange, placeholder, groups, allowCustom, disabled, error, style, title, emptyText, loading,
}: {
  label?: string;
  value: T | null | undefined;
  options: ComboOpt<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  /** Pestañas para filtrar (por ejemplo continentes). La primera puede ser "Todos". */
  groups?: { v: string; label: string }[];
  /** Si no está en la lista, deja usar lo que se escribió (solo para listas de texto). */
  allowCustom?: boolean;
  disabled?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
  emptyText?: string;
  loading?: boolean;
}) {
  const { L } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [g, setG] = useState<string>('*');
  const cur = options.find((o) => o.v === value);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return options.filter((o) => (g === '*' || o.group === g) && (!n || norm(o.label).includes(n) || (o.sub ? norm(o.sub).includes(n) : false)));
  }, [options, q, g]);
  const custom = allowCustom && q.trim() && !options.some((o) => norm(o.label) === norm(q.trim())) ? q.trim() : '';
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };
  const shownValue = cur ? cur.label : value != null && value !== '' ? String(value) : '';

  return (
    <View style={[{ gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 180 }, style]}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => { setG('*'); setOpen(true); }}
        style={({ pressed }) => ({ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: error ? C.red : C.line2, backgroundColor: disabled ? C.tint : C.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.85 : 1 })}
      >
        {cur?.left ? <Text style={{ fontSize: 18 }}>{cur.left}</Text> : null}
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: shownValue ? C.ink : '#93A5BD' }} numberOfLines={1}>
          {loading ? L('Cargando…', 'Loading…') : shownValue || placeholder || L('Elige una opción', 'Choose an option')}
        </Text>
        <Text style={{ color: C.muted, fontSize: 14 }}>▾</Text>
      </Pressable>
      {error ? <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel={L('Cerrar', 'Close')} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(11,31,58,0.45)', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 520, maxHeight: '86%', backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: C.ink }}>{title || label || L('Elige', 'Choose')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={L('Cerrar', 'Close')} onPress={() => setOpen(false)} hitSlop={10}>
                <Icon n="x" size={24} color={C.ink} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: C.line2, paddingHorizontal: 12, backgroundColor: C.cream }}>
              <Icon n="search" size={18} color={C.muted} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder={L('Escribe para buscar', 'Type to search')}
                placeholderTextColor="#93A5BD"
                accessibilityLabel={L('Buscar', 'Search')}
                style={[{ flex: 1, minHeight: 46, fontSize: 16, color: C.ink }, { outlineStyle: 'none' } as object]}
              />
            </View>
            {groups?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[{ v: '*', label: L('Todos', 'All') }, ...groups].map((x) => (
                  <Pressable key={x.v} accessibilityRole="tab" accessibilityState={{ selected: g === x.v }} onPress={() => setG(x.v)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: g === x.v ? C.sel : C.seg }}>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: g === x.v ? '#fff' : C.segInk }}>{x.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <FlatList
              data={shown}
              keyExtractor={(o) => String(o.v)}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={30}
              style={{ flexGrow: 0 }}
              ListFooterComponent={custom ? (
                <Pressable accessibilityRole="button" onPress={() => pick(custom as T)} style={{ marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: C.tint }}>
                  <Text style={{ fontWeight: '800', color: C.brown }}>{L(`No está en la lista: usar "${custom}"`, `Not listed: use "${custom}"`)}</Text>
                </Pressable>
              ) : null}
              ListEmptyComponent={<Text style={{ color: C.muted, padding: 12 }}>{loading ? L('Cargando…', 'Loading…') : emptyText || L('No hay resultados.', 'No results.')}</Text>}
              renderItem={({ item: o }) => {
                const on = o.v === value;
                return (
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!o.disabled }} disabled={o.disabled} onPress={() => pick(o.v)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10, backgroundColor: on ? C.tint : pressed ? C.cream : 'transparent', opacity: o.disabled ? 0.45 : 1 })}>
                    {o.left ? <Text style={{ fontSize: 20 }}>{o.left}</Text> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: on ? '900' : '600', color: C.ink }}>{o.label}</Text>
                      {o.sub ? <Text style={{ fontSize: 12.5, color: C.muted }}>{o.sub}</Text> : null}
                    </View>
                    {on ? <Icon n="check" size={18} color={C.brown} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
