/** País (todos, por continente), estado y municipio como listas desplegables con buscador. */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Combo } from '@/components/Combo';
import { allCountries, CONTINENTS, loadStates, type GeoState } from '@/lib/geo';
import { useLang } from '@/lib/i18n';

export function CountryCombo({ value, onChange, label, isAllowed, blockedText, errors }: {
  value: string; onChange: (c: string) => void; label: string;
  /** Si se da, los países que no pasan salen grises (por ejemplo, a los que aún no se envía). */
  isAllowed?: (c: string) => boolean; blockedText?: string; errors?: string;
}) {
  const { L, lang } = useLang();
  const opts = useMemo(() => {
    const all = allCountries().map((c) => {
      const ok = !isAllowed || isAllowed(c.c);
      return { v: c.c, label: lang === 'es' ? c.es : c.en, left: c.flag, group: c.cont, disabled: !ok, sub: !ok ? blockedText : undefined };
    });
    // Los disponibles primero
    return isAllowed ? [...all.filter((o) => !o.disabled), ...all.filter((o) => o.disabled)] : all;
  }, [lang, isAllowed, blockedText]);
  return (
    <Combo label={label} value={value} onChange={onChange} options={opts} groups={CONTINENTS.map((c) => ({ v: c.v, label: lang === 'es' ? c.es : c.en }))}
      placeholder={L('Elige el país', 'Choose the country')} title={label} error={errors} />
  );
}

export function useStates(country: string) {
  const [st, setSt] = useState<GeoState[] | null>(null);
  useEffect(() => {
    let alive = true;
    setSt(null);
    loadStates(country).then((x) => alive && setSt(x));
    return () => { alive = false; };
  }, [country]);
  return st;
}

/** Estado y municipio (o ciudad). Al elegir el estado aparecen sus municipios. */
export function StateCityPicker({ country, estado, ciudad, onEstado, onCiudad, errEstado, errCiudad, hideCity }: {
  country: string; estado: string; ciudad?: string; onEstado: (v: string) => void; onCiudad?: (v: string) => void;
  errEstado?: string; errCiudad?: string; hideCity?: boolean;
}) {
  const { L } = useLang();
  const states = useStates(country);
  const cur = states?.find((s) => s.n === estado);
  const stLabel = country === 'MX' || country === 'US' ? L('Estado', 'State') : L('Estado, departamento o provincia', 'State or province');
  const ctLabel = country === 'MX' ? L('Municipio', 'Municipality') : L('Ciudad o municipio', 'City');
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Combo label={stLabel} value={estado} onChange={(v) => { onEstado(v); onCiudad?.(''); }} options={(states || []).map((s) => ({ v: s.n, label: s.n }))}
        loading={!states} allowCustom placeholder={L('Elige el estado', 'Choose the state')} error={errEstado} emptyText={L('Escribe el nombre y tócalo para usarlo.', 'Type the name and tap it to use it.')} />
      {hideCity ? null : (
        <Combo label={ctLabel} value={ciudad || ''} onChange={(v) => onCiudad?.(v)} options={(cur?.c || []).map((c) => ({ v: c, label: c }))}
          disabled={!estado} allowCustom placeholder={estado ? L('Elige el municipio', 'Choose the municipality') : L('Primero elige el estado', 'Choose the state first')} error={errCiudad}
          emptyText={L('Escribe el nombre y tócalo para usarlo.', 'Type the name and tap it to use it.')} />
      )}
    </View>
  );
}
