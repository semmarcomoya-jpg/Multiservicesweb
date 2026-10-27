import React, { useEffect, useState } from 'react';

import { Btn, Card, Field, H2, Loading, Note, P, Row, Screen } from '@/components/ui';
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
  useEffect(() => {
    if (cfg) setF({ terms_es: cfg.terms_es || '', terms_en: cfg.terms_en || '', help_wa: cfg.help_wa || '', help_mail: cfg.help_mail || '' });
  }, [cfg]);
  if (!cfg) return <Loading />;
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: k === 'help_wa' ? digits(v) : v }));
  const save = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const { error } = await supabase.from('settings').update(f).eq('id', 1);
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
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      <Btn title={L('Guardar', 'Save')} icon="check" onPress={save} loading={busy} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
