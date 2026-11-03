import { router } from 'expo-router';
import React, { useState } from 'react';

import { BackBar, Btn, Card, Field, H1, Note, Pills, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/data';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

import { countryOf, phoneOk, sendCountries } from '@/lib/countries';
import { Combo } from '@/components/Combo';
import { CountryCombo, StateCityPicker } from '@/components/PlacePicker';

export default function NuevoBeneficiario() {
  const { L } = useLang();
  const { session } = useAuth();
  const { data: cfg } = useSettings();
  const [f, setF] = useState({ pais: 'MX', nombre: '', apellidos: '', parentesco: '', telefono: '', estado: '', ciudad: '', metodo: 'cuenta' as 'cuenta' | 'efectivo', banco: '', cuenta: '', red: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const co = countryOf(f.pais);
  const lang2 = L('es', 'en');
  const BANCOS = co.bancos;
  // México usa la lista de redes que pone el administrador (Admin → Reglas)
  const REDES = f.pais === 'MX' && cfg?.redes ? cfg.redes.split(',').map((x) => x.trim()).filter(Boolean) : co.redes;
  const paises = sendCountries(cfg);
  const allowed = React.useCallback((c: string) => paises.some((p) => p.c === c), [paises.map((p) => p.c).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const PAR = [L('Mamá', 'Mother'), L('Papá', 'Father'), L('Esposa(o)', 'Spouse'), L('Hija(o)', 'Child'), L('Hermana(o)', 'Sibling'), L('Otro', 'Other')];

  const cl = digits(f.cuenta);
  const errors: Record<string, string> = {
    nombre: f.nombre.trim() ? '' : L('Escribe el nombre', 'Enter the first name'),
    apellidos: f.apellidos.trim() ? '' : L('Escribe los apellidos (como en su identificación)', 'Enter the last name (as on their ID)'),
    telefono: phoneOk(co, digits(f.telefono).length) ? '' : co.phone ? L(`Teléfono a ${co.phone} dígitos`, `${co.phone}-digit phone`) : L('Escribe el teléfono con lada', 'Enter the phone with area code'),
    estado: f.estado.trim() ? '' : L('Elige el estado', 'Choose the state'),
    ciudad: f.ciudad.trim() ? '' : L('Elige el municipio o ciudad', 'Choose the city'),
    banco: f.metodo === 'cuenta' && !f.banco ? L('Elige el banco', 'Choose the bank') : '',
    cuenta: f.metodo === 'cuenta' && (f.pais === 'MX' ? cl.length !== 18 && cl.length !== 16 : cl.length < 6 || cl.length > 22) ? (f.pais === 'MX' ? L('CLABE de 18 dígitos o tarjeta de 16', '18-digit CLABE or 16-digit card') : L('Escribe el número de cuenta', 'Enter the account number')) : '',
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
      pais: f.pais,
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
      <BackBar title={L('Nueva persona', 'New person')} />
      <H1>{L('¿Quién recibe el dinero?', 'Who receives the money?')}</H1>
      <Card>
        <CountryCombo label={L('¿En qué país recibe?', 'Which country do they receive in?')} value={f.pais}
          isAllowed={allowed} blockedText={L('Envíos próximamente', 'Transfers coming soon')}
          onChange={(v) => setF((p) => ({ ...p, pais: v, estado: '', ciudad: '', banco: '', red: '' }))} />
        {!allowed(f.pais) ? <Note kind="gold" icon="send">{L(`Puedes guardar a esta persona, pero todavía no hacemos envíos a ${co.es}. Te avisamos cuando abramos.`, `You can save this person, but we do not send to ${co.en} yet. We will let you know.`)}</Note> : null}
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={f.nombre} onChangeText={set('nombre')} error={e('nombre')} autoCapitalize="words" />
          <Field label={L('Apellidos', 'Last name')} value={f.apellidos} onChangeText={set('apellidos')} error={e('apellidos')} autoCapitalize="words" />
        </Row>
        <Combo label={L('Parentesco', 'Relationship')} options={PAR.map((p) => ({ v: p, label: p }))} value={f.parentesco} onChange={set('parentesco')} allowCustom placeholder={L('Elige el parentesco', 'Choose the relationship')} />
        <Field label={L(`Teléfono en ${co.es}`, `Phone in ${co.en}`)} value={f.telefono} onChangeText={(v) => set('telefono')(digits(v))} keyboardType="phone-pad" maxLength={co.phone || 15} error={e('telefono')} />
        <StateCityPicker country={f.pais} estado={f.estado} ciudad={f.ciudad} onEstado={set('estado')} onCiudad={set('ciudad')} errEstado={e('estado')} errCiudad={e('ciudad')} />
      </Card>
      <Card>
        <Pills
          combo={false}
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
            <Combo label={L('Banco', 'Bank')} options={BANCOS.filter((b) => b !== 'Otro').map((b) => ({ v: b, label: b }))} value={f.banco} onChange={set('banco')} allowCustom
              placeholder={L('Elige o escribe el banco', 'Choose or type the bank')} error={e('banco')} emptyText={L('Escribe el nombre del banco y tócalo para usarlo.', 'Type the bank name and tap it.')} />
            <Field label={L(co.acct, co.acctEn)} value={f.cuenta} onChangeText={(v) => set('cuenta')(digits(v))} keyboardType="number-pad" maxLength={f.pais === 'MX' ? 18 : 22} error={e('cuenta')} />
          </>
        ) : (
          <>
            <Combo label={L('¿Dónde recoge?', 'Where do they pick it up?')} options={REDES.map((r) => ({ v: r, label: r }))} value={f.red} onChange={set('red')} allowCustom
              placeholder={L('Elige dónde recoge', 'Choose the pickup place')} error={e('red')} emptyText={L('Escribe el nombre y tócalo para usarlo.', 'Type the name and tap it.')} />
            <Note kind="blue">{L('Debe llevar identificación oficial con el mismo nombre.', 'They must bring an official ID with the same name.')}</Note>
          </>
        )}
      </Card>
      {err ? <Note kind="red">{err}</Note> : null}
      <Btn title={L('Guardar persona', 'Save person')} onPress={save} loading={busy} />
    </Screen>
  );
}
