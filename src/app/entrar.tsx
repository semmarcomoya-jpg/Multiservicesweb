import { router } from 'expo-router';
import React, { useState } from 'react';

import { BackBar, Btn, Card, Field, H1, Note, P, Screen } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

export default function Entrar() {
  const { L } = useLang();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const login = async () => {
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) {
      setErr(error.message.includes('Invalid') ? L('Correo o contraseña incorrectos.', 'Wrong email or password.') : errMsg(error));
      return;
    }
    router.replace('/');
  };

  const reset = async () => {
    if (!email.trim()) {
      setErr(L('Escribe tu correo para mandarte el enlace.', 'Type your email so we can send the link.'));
      return;
    }
    await supabase.auth.resetPasswordForEmail(email.trim());
    setSent(true);
  };

  return (
    <Screen wall="profile">
      <BackBar />
      <H1>{L('Entrar', 'Sign in')}</H1>
      <Card>
        <Field label={L('Correo', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label={L('Contraseña', 'Password')} value={pass} onChangeText={setPass} secure />
        {err ? <Note kind="red">{err}</Note> : null}
        {sent ? <Note kind="blue">{L('Te mandamos un correo para cambiar tu contraseña.', 'We sent you an email to reset your password.')}</Note> : null}
        <Btn title={L('Entrar', 'Sign in')} onPress={login} loading={busy} disabled={!email || !pass} />
        <Btn kind="ghost" small title={L('Olvidé mi contraseña', 'I forgot my password')} onPress={reset} />
      </Card>
      <P small muted style={{ textAlign: 'center' }}>{L('Las tiendas y el administrador también entran aquí.', 'Stores and the administrator sign in here too.')}</P>
    </Screen>
  );
}
