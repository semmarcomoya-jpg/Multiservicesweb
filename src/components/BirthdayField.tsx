/** Fecha de cumpleaños con tres listas: Día, Mes (con nombre) y Año. Sin escribir formatos. */
import React from 'react';
import { Platform, View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Label, P } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** value / onChange usan "dd/mm/aaaa" (vacío = sin fecha). */
export function BirthdayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { L, lang } = useLang();
  const [d = '', m = '', y = ''] = value ? value.split('/') : [];
  const set = (nd: string, nm: string, ny: string) => onChange(nd || nm || ny ? `${nd}/${nm}/${ny}` : '');
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - 14 - i));
  const meses = lang === 'es' ? MES_ES : MES_EN;
  const daysIn = m && y ? new Date(Number(y), Number(m), 0).getDate() : 31;
  const days = Array.from({ length: daysIn }, (_, i) => String(i + 1).padStart(2, '0'));
  const complete = d && m && y;

  const sel = (label: string, val: string, opts: [string, string][], onPick: (v: string) => void, flex: number) =>
    Platform.OS === 'web' ? (
      <View style={{ flex, minWidth: 0, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.muted }}>{label}</Text>
        {React.createElement(
          'select',
          {
            value: val,
            'aria-label': label,
            onChange: (e: { target: { value: string } }) => onPick(e.target.value),
            style: {
              height: 50, borderRadius: R.md, border: `1.5px solid ${val ? C.brown : C.line2}`, background: '#fff', color: C.ink,
              fontSize: 16, fontFamily: 'Nunito_700Bold, Nunito, sans-serif', padding: '0 10px', width: '100%', appearance: 'auto',
            },
          },
          React.createElement('option', { value: '' }, '—'),
          ...opts.map(([v, t]) => React.createElement('option', { key: v, value: v }, t)),
        )}
      </View>
    ) : (
      <View style={{ flex, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.muted }}>{label}</Text>
        <TextInput value={val} onChangeText={(t) => onPick(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={label === L('Año', 'Year') ? 4 : 2}
          style={{ height: 50, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line2, backgroundColor: '#fff', paddingHorizontal: 12, fontSize: 16, color: C.ink }} />
      </View>
    );

  return (
    <View style={{ gap: 6 }}>
      <Label>{L('Fecha de nacimiento', 'Date of birth')}</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {sel(L('Día', 'Day'), d, days.map((x) => [x, String(Number(x))]), (v) => set(v, m, y), 1)}
        {sel(L('Mes', 'Month'), m, meses.map((t, i) => [String(i + 1).padStart(2, '0'), t]), (v) => set(d && Number(d) > new Date(Number(y) || 2000, Number(v), 0).getDate() ? '' : d, v, y), 1.6)}
        {sel(L('Año', 'Year'), y, years.map((x) => [x, x]), (v) => set(d, m, v), 1.2)}
      </View>
      <P small muted>
        {complete
          ? L(`🎂 Tu cumpleaños: ${Number(d)} de ${MES_ES[Number(m) - 1]}. Ese mes te consentimos.`, `🎂 Your birthday: ${MES_EN[Number(m) - 1]} ${Number(d)}. We treat you that month.`)
          : L('Opcional. Te consentimos en tu cumpleaños.', 'Optional. We treat you on your birthday.')}
      </P>
      {value && !complete ? (
        <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>
          {L('Completa día, mes y año, o déjalos vacíos.', 'Fill in day, month and year, or leave them empty.')}{' '}
          <Text onPress={() => onChange('')} style={{ color: C.blue, textDecorationLine: 'underline' }}>{L('Borrar fecha', 'Clear date')}</Text>
        </Text>
      ) : null}
    </View>
  );
}
