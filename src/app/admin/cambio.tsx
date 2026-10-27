import React, { useEffect, useState } from 'react';
import { Text } from '@/components/Text';

import { PanelHeader } from '@/components/panel';
import { Btn, Card, Field, H2, Loading, Note, P, Row, Screen } from '@/components/ui';
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

  useEffect(() => {
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
        <H2>{L('Tipo de cambio', 'Exchange rate')}</H2>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={L('1 USD = ? MXN', '1 USD = ? MXN')} value={f.exchange_rate} onChangeText={set('exchange_rate')} keyboardType="decimal-pad" style={{ maxWidth: 240 }} />
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.blueInk, paddingBottom: 6 }}>{Number(f.exchange_rate || 0).toFixed(2)} MXN</Text>
        </Row>
        <P small muted>{L('Última actualización: ', 'Last updated: ') + new Date(cfg.rate_updated_at).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}</P>
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
      <Btn title={L('Guardar', 'Save')} onPress={save} loading={busy} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
