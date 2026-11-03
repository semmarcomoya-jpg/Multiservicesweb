import React, { useEffect, useState } from 'react';
import { Text } from '@/components/Text';

import { Btn, Card, Field, H2, Loading, Note, P, Row, Screen, Toggle } from '@/components/ui';
import { COUNTRIES, countryOf } from '@/lib/countries';
import { CountryCombo } from '@/components/PlacePicker';
import { useSettings } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function AdminCambio() {
  const { L, lang } = useLang();
  const { data: cfg, reload } = useSettings();
  const [f, setF] = useState({ exchange_rate: '', send_fee: '', limit_l1: '', limit_l2: '', proveedor: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [paises, setPaises] = useState<{ c: string; on: boolean; cur: string; rate: string; fee: string }[]>([]);

  useEffect(() => {
    if (cfg)
      setPaises(
        [...COUNTRIES.filter((c) => c.c !== 'MX' && c.c !== 'US').map((c) => c.c), ...(cfg.paises || []).map((x) => x.c).filter((c) => c !== 'MX' && !COUNTRIES.some((k) => k.c === c))].map((code) => {
          const c = countryOf(code);
          const p = (cfg.paises || []).find((x) => x.c === code);
          return { c: code, on: !!p?.on, cur: p?.cur || c.cur, rate: p ? String(p.rate) : '', fee: p ? String(p.fee) : String(cfg.send_fee) };
        }),
      );
    if (cfg) setF({ exchange_rate: String(cfg.exchange_rate), send_fee: String(cfg.send_fee), limit_l1: String(cfg.limit_l1), limit_l2: String(cfg.limit_l2), proveedor: cfg.proveedor });
  }, [cfg]);
  if (!cfg) return <Loading />;
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: k === 'proveedor' ? v : v.replace(/[^0-9.]/g, '') }));

  const save = async () => {
    setBusy(true);
    setErr('');
    const rateChanged = Number(f.exchange_rate) !== Number(cfg.exchange_rate);
    const { error } = await supabase
      .from('settings')
      .update({
        exchange_rate: Number(f.exchange_rate),
        send_fee: Number(f.send_fee),
        limit_l1: Number(f.limit_l1),
        limit_l2: Number(f.limit_l2),
        proveedor: f.proveedor,
        paises: [{ c: 'MX', on: true, cur: 'MXN', rate: 0, fee: 0 }, ...paises.map((p) => ({ c: p.c, on: p.on, cur: p.cur, rate: Number(p.rate) || 0, fee: Number(p.fee) || 0 }))],
        ...(rateChanged ? { rate_updated_at: new Date().toISOString() } : {}),
      })
      .eq('id', 1);
    setBusy(false);
    if (error) setErr(errMsg(error));
    else {
      setMsg(L('Guardado. Los clientes ya ven los nuevos valores.', 'Saved. Customers now see the new values.'));
      reload();
    }
  };

  return (
    <Screen wide>
      <Card>
        <H2>{L('Tipo de cambio · México', 'Exchange rate · Mexico')}</H2>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={L('1 USD = ? MXN', '1 USD = ? MXN')} value={f.exchange_rate} onChangeText={set('exchange_rate')} keyboardType="decimal-pad" style={{ maxWidth: 240 }} />
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.blueInk, paddingBottom: 6 }}>{Number(f.exchange_rate || 0).toFixed(2)} MXN</Text>
        </Row>
        <P small muted>{L('Última actualización: ', 'Last updated: ') + new Date(cfg.rate_updated_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}</P>
      </Card>
      <Card>
        <H2>{L('Otros países', 'Other countries')}</H2>
        <P small muted>{L('Prende los países a los que envías y pon su tipo de cambio y comisión. El cliente los elige al agregar a la persona que recibe. Revisa el tipo de cambio cada día, igual que el de México.', 'Turn on the countries you send to and set their rate and fee. Customers pick the country when adding a recipient. Update rates daily, like Mexico.')}</P>
        {paises.map((p, i) => {
          const c = countryOf(p.c);
          const upd = (patch: Partial<typeof p>) => setPaises((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <Row key={p.c} style={{ alignItems: 'flex-end', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Toggle label={`${c.flag} ${lang === 'es' ? c.es : c.en}`} value={p.on} onChange={(v) => upd({ on: v })} />
              <Field label={`1 USD = ? ${p.cur}`} value={p.rate} onChangeText={(v) => upd({ rate: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={{ maxWidth: 170 }} />
              <Field label={L('Comisión (USD)', 'Fee (USD)')} value={p.fee} onChangeText={(v) => upd({ fee: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={{ maxWidth: 150 }} />
            </Row>
          );
        })}
        <CountryCombo label={L('Agregar otro país', 'Add another country')} value=""
          isAllowed={(c) => c !== 'MX' && c !== 'US' && !paises.some((p) => p.c === c)} blockedText={L('Ya está en la lista', 'Already listed')}
          onChange={(c) => setPaises((arr) => [...arr, { c, on: true, cur: countryOf(c).cur, rate: '', fee: String(cfg.send_fee) }])} />
        {paises.some((p) => p.on && !(Number(p.rate) > 0)) ? <Note kind="red">{L('Un país prendido necesita su tipo de cambio.', 'An enabled country needs its rate.')}</Note> : null}
      </Card>
      <Card>
        <H2>{L('Envíos: comisión y límites', 'Transfers: fee and limits')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Comisión por envío (USD)', 'Fee per transfer (USD)')} value={f.send_fee} onChangeText={set('send_fee')} keyboardType="decimal-pad" />
          <Field label={L('Límite sin identificación (USD)', 'Limit without ID (USD)')} value={f.limit_l1} onChangeText={set('limit_l1')} keyboardType="decimal-pad" />
          <Field label={L('Límite con identificación verificada (USD)', 'Limit with verified ID (USD)')} value={f.limit_l2} onChangeText={set('limit_l2')} keyboardType="decimal-pad" />
          <Field label={L('Proveedor de envíos', 'Transfer provider')} value={f.proveedor} onChangeText={set('proveedor')} />
        </Row>
        <Note kind="gold" icon="shield">{L('Los envíos de dinero están regulados (licencia de transmisor de dinero por estado y reglas de FinCEN). Confirma tus límites con tu proveedor y un asesor legal.', 'Money transfers are regulated (state money transmitter licenses and FinCEN rules). Confirm your limits with your provider and a legal advisor.')}</Note>
      </Card>
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      <Btn title={L('Guardar', 'Save')} onPress={save} loading={busy} disabled={paises.some((p) => p.on && !(Number(p.rate) > 0))} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
