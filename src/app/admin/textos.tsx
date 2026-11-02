import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { C } from '@/lib/theme';

import { Btn, Card, Field, H2, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { COUNTRIES } from '@/lib/countries';
import { useSettings } from '@/lib/data';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

export default function AdminTextos() {
  const { L } = useLang();
  const { data: cfg, reload } = useSettings();
  const [f, setF] = useState({ terms_es: '', terms_en: '', help_wa: '', help_mail: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  type Dia = { m: string; d: string; es: string; en: string; pais: string; estado: string };
  const [dias, setDias] = useState<Dia[]>([]);
  useEffect(() => {
    if (cfg) setDias((cfg.dias || []).map((x) => ({ m: String(x.m), d: String(x.d), es: x.es, en: x.en || '', pais: x.pais || '*', estado: x.estado || '' })));
    if (cfg) setF({ terms_es: cfg.terms_es || '', terms_en: cfg.terms_en || '', help_wa: cfg.help_wa || '', help_mail: cfg.help_mail || '' });
  }, [cfg]);
  if (!cfg) return <Loading />;
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: k === 'help_wa' ? digits(v) : v }));
  const save = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const clean = dias.filter((x) => x.es.trim() && +x.m >= 1 && +x.m <= 12 && +x.d >= 1 && +x.d <= 31).map((x) => ({ m: +x.m, d: +x.d, es: x.es.trim(), en: x.en.trim() || x.es.trim(), pais: x.pais || '*', estado: x.estado.trim() }));
    const { error } = await supabase.from('settings').update({ ...f, dias: clean }).eq('id', 1);
    setBusy(false);
    if (error) setErr(errMsg(error));
    else {
      setMsg(L('Guardado. Los clientes ya lo ven en Ayuda.', 'Saved. Customers now see it in Help.'));
      reload();
    }
  };
  return (
    <Screen wide>
      <Card>
        <H2>{L('Contacto de ayuda', 'Help contact')}</H2>
        <P small muted>{L('Aparecen en Perfil → Ayuda para que el cliente te escriba.', 'Shown in Profile → Help so customers can reach you.')}</P>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('WhatsApp (con lada, solo números)', 'WhatsApp (with country code, digits only)')} value={f.help_wa} onChangeText={set('help_wa')} keyboardType="phone-pad" placeholder="13125550100" />
          <Field label={L('Correo de ayuda', 'Help email')} value={f.help_mail} onChangeText={set('help_mail')} autoCapitalize="none" keyboardType="email-address" />
        </Row>
      </Card>
      <Card>
        <H2>{L('Términos y aviso de privacidad', 'Terms and privacy notice')}</H2>
        <Field label={L('En español', 'In Spanish')} value={f.terms_es} onChangeText={set('terms_es')} multiline style={{ minHeight: 200 }} />
        <Field label={L('En inglés', 'In English')} value={f.terms_en} onChangeText={set('terms_en')} multiline style={{ minHeight: 200 }} />
        <Note kind="gold" icon="shield">{L('Pide a un abogado que revise estos textos antes de publicarlos.', 'Have a lawyer review these texts before publishing them.')}</Note>
      </Card>
      <Card>
        <H2>{L('Días especiales propios', 'Custom special days')}</H2>
        <P small muted>{L('Los días de EE. UU. y de cada país ya salen solos en la tarjeta del cliente. Aquí agregas otros: la fiesta del pueblo, el aniversario de la tienda o una promoción. Puedes limitarlos a un país y estado.', 'U.S. and national days already show up automatically. Add others here: a town festival, the store anniversary or a promotion. You can limit them to a country and state.')}</P>
        {dias.map((x, i) => {
          const upd = (p: Partial<Dia>) => setDias((a) => a.map((y, j) => (j === i ? { ...y, ...p } : y)));
          return (
            <View key={i} style={{ gap: 6, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Row style={{ alignItems: 'flex-end' }}>
                <Field label={L('Día', 'Day')} value={x.d} onChangeText={(v) => upd({ d: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" style={{ maxWidth: 80, minWidth: 70 }} />
                <Field label={L('Mes', 'Month')} value={x.m} onChangeText={(v) => upd({ m: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" style={{ maxWidth: 80, minWidth: 70 }} />
                <Field label={L('Nombre (español)', 'Name (Spanish)')} value={x.es} onChangeText={(v) => upd({ es: v })} />
                <Field label={L('Nombre (inglés)', 'Name (English)')} value={x.en} onChangeText={(v) => upd({ en: v })} />
              </Row>
              <Row style={{ alignItems: 'flex-end' }}>
                <Pills label={L('Para clientes de', 'For customers from')} options={[{ v: '*', label: L('Todos', 'Everyone') }, ...COUNTRIES.filter((c) => c.c !== 'US').map((c) => ({ v: c.c, label: `${c.flag} ${c.es}` }))]} value={x.pais} onChange={(v) => upd({ pais: v })} wrap={false} />
              </Row>
              <Row style={{ alignItems: 'flex-end' }}>
                {x.pais !== '*' ? <Field label={L('Solo de este estado (opcional)', 'Only this state (optional)')} value={x.estado} onChangeText={(v) => upd({ estado: v })} style={{ maxWidth: 280 }} /> : null}
                <Btn small kind="ghost" title={L('Quitar', 'Remove')} onPress={() => setDias((a) => a.filter((_, j) => j !== i))} />
              </Row>
            </View>
          );
        })}
        <Btn small kind="ghost" icon="plus" title={L('Agregar día', 'Add day')} style={{ alignSelf: 'flex-start' }} onPress={() => setDias((a) => [...a, { m: '', d: '', es: '', en: '', pais: '*', estado: '' }])} />
      </Card>
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      <Btn title={L('Guardar', 'Save')} icon="check" onPress={save} loading={busy} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
