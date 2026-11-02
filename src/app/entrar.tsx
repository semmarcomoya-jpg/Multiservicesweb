import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Scene } from '@/components/scenes';

import { BackBar, Btn, Card, Field, H1, Note, P, Screen } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

type Mode = 'code' | 'pass';

export default function Entrar() {
  const { L } = useLang();
  const [mode, setMode] = useState<Mode>('code');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const mail = email.trim().toLowerCase();
  const validMail = /^\S+@\S+\.\S+$/.test(mail);

  const login = async () => {
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
    setBusy(false);
    if (error) {
      setErr(error.message.includes('Invalid') ? L('Correo o contraseña incorrectos.', 'Wrong email or password.') : errMsg(error));
      return;
    }
    router.replace('/');
  };

  // Entrar con código: solo para cuentas que ya existen (no crea cuentas nuevas)
  const sendCode = async () => {
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      setErr(m.includes('signups not allowed') || m.includes('not found') ? L('No encontramos una cuenta con ese correo. Crea tu cuenta primero.', 'No account with that email. Create your account first.') : m.includes('rate') || m.includes('seconds') ? L('Espera un minuto antes de pedir otro código.', 'Wait a minute before asking for another code.') : errMsg(error));
      return;
    }
    setCodeSent(true);
  };
  const verify = async () => {
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: mail, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) {
      setErr(L('El código no es correcto o ya venció. Pide uno nuevo.', 'The code is wrong or expired. Ask for a new one.'));
      return;
    }
    router.replace('/');
  };

  const reset = async () => {
    if (!mail) {
      setErr(L('Escribe tu correo para mandarte el enlace.', 'Type your email so we can send the link.'));
      return;
    }
    await supabase.auth.resetPasswordForEmail(mail);
    setSent(true);
  };

  return (
    <Screen wall="profile">
      <BackBar />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <View style={{ width: 120, height: 90 }}><Scene n="envio" /></View>
        <H1 style={{ textAlign: 'center' }}>{L('Entra a Castillo', 'Sign in to Castillo')}</H1>
        <P muted style={{ textAlign: 'center' }}>{mode === 'code' ? L('Sin contraseña: te mandamos un código a tu correo.', 'No password: we email you a code.') : L('Con tu correo y contraseña de siempre.', 'With your usual email and password.')}</P>
      </View>
      <Card>
        <Field label={L('Correo', 'Email')} value={email} onChangeText={(v) => { setEmail(v); setCodeSent(false); }} keyboardType="email-address" autoCapitalize="none" />
        {mode === 'pass' ? (
          <>
            <Field label={L('Contraseña', 'Password')} value={pass} onChangeText={setPass} secure />
            {err ? <Note kind="red">{err}</Note> : null}
            {sent ? <Note kind="blue">{L('Te mandamos un correo para cambiar tu contraseña.', 'We sent you an email to reset your password.')}</Note> : null}
            <Btn title={L('Entrar', 'Sign in')} onPress={login} loading={busy} disabled={!email || !pass} />
            <Btn kind="ghost" small title={L('Olvidé mi contraseña', 'I forgot my password')} onPress={reset} />
          </>
        ) : !codeSent ? (
          <>
            <P small muted>{L('Te mandamos un código de 6 números a tu correo. Sin contraseñas que recordar.', 'We email you a 6-digit code. No password to remember.')}</P>
            {err ? <Note kind="red">{err}</Note> : null}
            <Btn icon="send" title={L('Mandarme el código', 'Send me the code')} onPress={sendCode} loading={busy} disabled={!validMail} />
          </>
        ) : (
          <>
            <Note kind="blue" icon="check">{L(`Revisa ${mail} (también en spam) y escribe el código.`, `Check ${mail} (spam too) and type the code.`)}</Note>
            <Field label={L('Código de 6 dígitos', '6-digit code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="123456" />
            {err ? <Note kind="red">{err}</Note> : null}
            <Btn title={L('Entrar', 'Sign in')} onPress={verify} loading={busy} disabled={code.length < 6} />
            <Btn kind="ghost" small title={L('Mandar otro código', 'Send another code')} onPress={sendCode} disabled={busy} />
          </>
        )}
        <Btn kind="ghost" small title={mode === 'code' ? L('Entrar con contraseña', 'Sign in with password') : L('Entrar con código al correo', 'Sign in with an email code')} onPress={() => { setMode(mode === 'code' ? 'pass' : 'code'); setErr(''); }} />
      </Card>
      <P small muted style={{ textAlign: 'center' }}>{L('Las tiendas y el administrador también entran aquí.', 'Stores and the administrator sign in here too.')}</P>
    </Screen>
  );
}
