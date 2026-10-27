import { router } from 'expo-router';
import React, { useState } from 'react';

import { BackBar, Btn, Card, Field, H1, Note, Pills, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

const BANCOS = ['BBVA', 'Banorte', 'Santander', 'Banamex', 'Banco Azteca', 'Coppel', 'HSBC', 'Bancoppel', 'Otro'];
const REDES = ['Elektra', 'Coppel', 'OXXO', 'Walmart', 'Soriana', 'Telecomm'];

export default function NuevoBeneficiario() {
  const { L } = useLang();
  const { session } = useAuth();
  const [f, setF] = useState({ nombre: '', apellidos: '', parentesco: '', telefono: '', estado: '', ciudad: '', metodo: 'cuenta' as 'cuenta' | 'efectivo', banco: '', cuenta: '', red: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const PAR = [L('Mamá', 'Mother'), L('Papá', 'Father'), L('Esposa(o)', 'Spouse'), L('Hija(o)', 'Child'), L('Hermana(o)', 'Sibling'), L('Otro', 'Other')];

  const cl = digits(f.cuenta);
  const errors: Record<string, string> = {
    nombre: f.nombre.trim() ? '' : L('Escribe el nombre', 'Enter the first name'),
    apellidos: f.apellidos.trim() ? '' : L('Escribe los apellidos (como en su identificación)', 'Enter the last name (as on their ID)'),
    telefono: digits(f.telefono).length === 10 ? '' : L('Teléfono a 10 dígitos', '10-digit phone'),
    estado: f.estado.trim() ? '' : L('Escribe el estado', 'Enter the state'),
    ciudad: f.ciudad.trim() ? '' : L('Escribe la ciudad', 'Enter the city'),
    banco: f.metodo === 'cuenta' && !f.banco ? L('Elige el banco', 'Choose the bank') : '',
    cuenta: f.metodo === 'cuenta' && cl.length !== 18 && cl.length !== 16 ? L('CLABE de 18 dígitos o tarjeta de 16', '18-digit CLABE or 16-digit card') : '',
    red: f.metodo === 'efectivo' && !f.red ? L('Elige dónde recoge', 'Choose the pickup network') : '',
  };
  const ok = Object.values(errors).every((x) => !x);
  const e = (k: string) => (tried ? errors[k] : '');

  const save = async () => {
    setTried(true);
    if (!ok || !session) return;
    setBusy(true);
    const { error } = await supabase.from('beneficiaries').insert({
      user_id: session.user.id,
      nombre: f.nombre.trim(),
      apellidos: f.apellidos.trim(),
      parentesco: f.parentesco,
      telefono: digits(f.telefono),
      estado: f.estado.trim(),
      ciudad: f.ciudad.trim(),
      metodo: f.metodo,
      banco: f.metodo === 'cuenta' ? f.banco : '',
      cuenta: f.metodo === 'cuenta' ? cl : '',
      red: f.metodo === 'efectivo' ? f.red : '',
    });
    setBusy(false);
    if (error) {
      setErr(errMsg(error));
      return;
    }
    router.back();
  };

  return (
    <Screen wall="send">
      <BackBar title={L('Nuevo beneficiario', 'New recipient')} />
      <H1>{L('¿Quién recibe el dinero?', 'Who receives the money?')}</H1>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={f.nombre} onChangeText={set('nombre')} error={e('nombre')} autoCapitalize="words" />
          <Field label={L('Apellidos', 'Last name')} value={f.apellidos} onChangeText={set('apellidos')} error={e('apellidos')} autoCapitalize="words" />
        </Row>
        <Pills label={L('Parentesco', 'Relationship')} options={PAR.map((p) => ({ v: p, label: p }))} value={f.parentesco} onChange={set('parentesco')} />
        <Field label={L('Teléfono en México', 'Phone in Mexico')} value={f.telefono} onChangeText={(v) => set('telefono')(digits(v))} keyboardType="phone-pad" maxLength={10} error={e('telefono')} />
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Estado', 'State')} value={f.estado} onChangeText={set('estado')} error={e('estado')} autoCapitalize="words" />
          <Field label={L('Ciudad o municipio', 'City')} value={f.ciudad} onChangeText={set('ciudad')} error={e('ciudad')} autoCapitalize="words" />
        </Row>
      </Card>
      <Card>
        <Pills
          label={L('¿Cómo recibe?', 'How do they receive it?')}
          options={[
            { v: 'cuenta', label: L('Depósito a cuenta', 'Bank deposit'), icon: 'bank' },
            { v: 'efectivo', label: L('Retiro en efectivo', 'Cash pickup'), icon: 'cash' },
          ]}
          value={f.metodo}
          onChange={(v) => setF((p) => ({ ...p, metodo: v as 'cuenta' | 'efectivo' }))}
        />
        {f.metodo === 'cuenta' ? (
          <>
            <Pills label={L('Banco', 'Bank')} options={BANCOS.map((b) => ({ v: b, label: b }))} value={f.banco} onChange={set('banco')} />
            {e('banco') ? <Note kind="red">{e('banco')}</Note> : null}
            <Field label={L('CLABE (18 dígitos) o tarjeta (16)', 'CLABE (18 digits) or card (16)')} value={f.cuenta} onChangeText={(v) => set('cuenta')(digits(v))} keyboardType="number-pad" maxLength={18} error={e('cuenta')} />
          </>
        ) : (
          <>
            <Pills label={L('¿Dónde recoge?', 'Where do they pick it up?')} options={REDES.map((r) => ({ v: r, label: r }))} value={f.red} onChange={set('red')} />
            {e('red') ? <Note kind="red">{e('red')}</Note> : null}
            <Note kind="blue">{L('Debe llevar identificación oficial con el mismo nombre.', 'They must bring an official ID with the same name.')}</Note>
          </>
        )}
      </Card>
      {err ? <Note kind="red">{err}</Note> : null}
      <Btn title={L('Guardar beneficiario', 'Save recipient')} onPress={save} loading={busy} />
    </Screen>
  );
}
