import { router } from 'expo-router';
import React, { useState } from 'react';

import { BackBar, Btn, Card, Field, H1, Note, P, Row, Screen } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { digits } from '@/lib/format';
import { errMsg, supabase } from '@/lib/supabase';

export default function Registro() {
  const { L, lang } = useLang();
  const [f, setF] = useState({ nombre: '', apellidos: '', telefono: '', email: '', pass: '' });
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const errors = {
    nombre: f.nombre.trim() ? '' : L('Escribe tu nombre', 'Enter your first name'),
    apellidos: f.apellidos.trim() ? '' : L('Escribe tus apellidos', 'Enter your last name'),
    telefono: digits(f.telefono).length === 10 ? '' : L('Tu teléfono a 10 dígitos', 'Your 10-digit phone'),
    email: /^\S+@\S+\.\S+$/.test(f.email.trim()) ? '' : L('Correo no válido', 'Invalid email'),
    pass: f.pass.length >= 8 ? '' : L('Mínimo 8 caracteres', 'At least 8 characters'),
  };
  const ok = Object.values(errors).every((x) => !x);
  const e = (k: keyof typeof errors) => (tried ? errors[k] : '');

  const submit = async () => {
    setTried(true);
    setErr('');
    if (!ok) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.pass,
      options: { data: { nombre: f.nombre.trim(), apellidos: f.apellidos.trim(), telefono: digits(f.telefono), idioma: lang } },
    });
    setBusy(false);
    if (error) {
      setErr(errMsg(error));
      return;
    }
    if (!data.session) {
      setConfirm(true);
      return;
    }
    router.replace('/');
  };

  if (confirm) {
    return (
      <Screen wall="profile">
        <BackBar />
        <H1>{L('Revisa tu correo', 'Check your email')}</H1>
        <Note kind="blue" icon="check">
          {L('Te mandamos un enlace para activar tu cuenta. Ábrelo y luego entra con tu correo y contraseña.', 'We sent you a link to activate your account. Open it, then sign in with your email and password.')}
        </Note>
        <Btn title={L('Ir a entrar', 'Go to sign in')} onPress={() => router.replace('/entrar')} />
      </Screen>
    );
  }

  return (
    <Screen wall="profile">
      <BackBar />
      <H1>{L('Crea tu cuenta', 'Create your account')}</H1>
      <P muted>{L('Solo lo necesario para atenderte. Puedes completar tu perfil después.', 'Just what we need to serve you. You can complete your profile later.')}</P>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={f.nombre} onChangeText={set('nombre')} error={e('nombre')} autoCapitalize="words" />
          <Field label={L('Apellidos', 'Last name')} value={f.apellidos} onChangeText={set('apellidos')} error={e('apellidos')} autoCapitalize="words" />
        </Row>
        <Field label={L('Teléfono (EE.UU.)', 'Phone (U.S.)')} value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" maxLength={14} error={e('telefono')} />
        <Field label={L('Correo', 'Email')} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={e('email')} />
        <Field label={L('Contraseña', 'Password')} value={f.pass} onChangeText={set('pass')} secure error={e('pass')} hint={L('Mínimo 8 caracteres', 'At least 8 characters')} />
        {err ? <Note kind="red">{err}</Note> : null}
        <Btn title={L('Crear cuenta', 'Create account')} onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
