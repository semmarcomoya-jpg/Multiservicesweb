import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { PanelHeader } from '@/components/panel';
import { Btn, Card, Field, H2, Note, P, Pills, Row, Screen, SearchBox, matches, Avatar } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { createAccount, errMsg, supabase } from '@/lib/supabase';
import { digits } from '@/lib/format';
import { C, R } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function AdminUsuarios() {
  const { L, lang } = useLang();
  // Crear cuenta
  const [n, setN] = useState({ nombre: '', apellidos: '', email: '', telefono: '', pass: '' });
  const [nRole, setNRole] = useState<'cliente' | 'tienda' | 'admin'>('cliente');
  const [nStore, setNStore] = useState<string | null>(null);
  const [nBusy, setNBusy] = useState(false);
  const [nMsg, setNMsg] = useState<{ ok: boolean; t: string } | null>(null);
  // Lista de cuentas con buscador
  const [all, setAll] = useState<Profile[] | null>(null);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState<'all' | 'cliente' | 'tienda' | 'admin'>('all');
  const loadAll = useCallback(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(2000).then(({ data }) => setAll((data as Profile[]) ?? []));
  }, []);
  useFocusEffect(loadAll);
  const { data: stores } = useStores();
  const [lookup, setLookup] = useState('');
  const [role, setRole] = useState<'cliente' | 'tienda' | 'admin'>('tienda');
  const [store, setStore] = useState<string | null>(null);
  const [found, setFound] = useState<Profile | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setErr('');
    setMsg('');
    setFound(null);
    const { data } = await supabase.from('profiles').select('*').ilike('member_code', lookup.trim()).maybeSingle();
    if (data) setFound(data as Profile);
    else setErr(L('No encontramos ese número de cliente. También puedes usar el correo al asignar el rol.', 'Member number not found. You can also use the email when assigning the role.'));
  };

  const genPass = () => {
    const ch = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let p = '';
    for (let i = 0; i < 10; i++) p += ch[Math.floor(Math.random() * ch.length)];
    setN((x) => ({ ...x, pass: p }));
  };
  const crear = async () => {
    setNMsg(null);
    const email = n.email.trim().toLowerCase();
    if (!n.nombre.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setNMsg({ ok: false, t: L('Escribe el nombre y un correo válido.', 'Enter the name and a valid email.') });
    if (n.pass.length < 8) return setNMsg({ ok: false, t: L('La contraseña debe tener al menos 8 caracteres.', 'Password must be at least 8 characters.') });
    if (nRole === 'tienda' && !nStore) return setNMsg({ ok: false, t: L('Elige la sucursal.', 'Choose the branch.') });
    setNBusy(true);
    try {
      const r = await createAccount({ email, password: n.pass, nombre: n.nombre.trim(), apellidos: n.apellidos.trim(), telefono: digits(n.telefono), idioma: lang });
      if (nRole !== 'cliente') {
        const { error } = await supabase.rpc('admin_set_role', { p_lookup: email, p_role: nRole, p_store: nRole === 'tienda' ? nStore : null });
        if (error) throw error;
      }
      setNMsg({
        ok: true,
        t:
          L(`Cuenta creada para ${email}. Contraseña: ${n.pass}. `, `Account created for ${email}. Password: ${n.pass}. `) +
          (r.needsConfirm ? L('Le llegará un correo para activarla antes de entrar.', 'They will get an email to activate it before signing in.') : L('Ya puede entrar.', 'They can sign in now.')),
      });
      setN({ nombre: '', apellidos: '', email: '', telefono: '', pass: '' });
      loadAll();
    } catch (e) {
      setNMsg({ ok: false, t: errMsg(e) });
    }
    setNBusy(false);
  };

  const assign = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_role', { p_lookup: lookup.trim(), p_role: role, p_store: role === 'tienda' ? store : null });
    setBusy(false);
    if (error) setErr(errMsg(error));
    else setMsg(L('Rol asignado. La cuenta debe cerrar sesión y volver a entrar.', 'Role assigned. The account must sign out and back in.'));
  };

  const setId = async (st: Profile['id_status']) => {
    if (!found) return;
    const { error } = await supabase.from('profiles').update({ id_status: st }).eq('id', found.id);
    if (error) setErr(errMsg(error));
    else {
      setFound({ ...found, id_status: st });
      setMsg(L('Estado de identificación actualizado.', 'ID status updated.'));
    }
  };

  const shownAll = (all || []).filter((p) => (rf === 'all' || p.role === rf) && matches(q, p.nombre, p.apellidos, p.member_code, p.telefono));

  return (
    <Screen wide>
      <Card>
        <H2>{L('Crear una cuenta', 'Create an account')}</H2>
        <P small muted>{L('Para un cliente que no sabe registrarse, o para el personal de una tienda. Los clientes también pueden registrarse solos con "Crear mi cuenta".', 'For a customer who cannot sign up, or for store staff. Customers can also sign up on their own with "Create my account".')}</P>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={n.nombre} onChangeText={(v) => setN((x) => ({ ...x, nombre: v }))} />
          <Field label={L('Apellidos', 'Last name')} value={n.apellidos} onChangeText={(v) => setN((x) => ({ ...x, apellidos: v }))} />
          <Field label={L('Correo', 'Email')} value={n.email} onChangeText={(v) => setN((x) => ({ ...x, email: v }))} autoCapitalize="none" keyboardType="email-address" />
          <Field label={L('Teléfono', 'Phone')} value={n.telefono} onChangeText={(v) => setN((x) => ({ ...x, telefono: digits(v) }))} keyboardType="phone-pad" maxLength={10} />
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={L('Contraseña temporal (mín. 8)', 'Temporary password (min. 8)')} value={n.pass} onChangeText={(v) => setN((x) => ({ ...x, pass: v }))} autoCapitalize="none" style={{ maxWidth: 320 }} />
          <Btn small kind="ghost" title={L('Generar', 'Generate')} onPress={genPass} />
        </Row>
        <Pills label={L('Tipo de cuenta', 'Account type')} options={[{ v: 'cliente', label: L('Cliente', 'Customer') }, { v: 'tienda', label: L('Tienda', 'Store') }, { v: 'admin', label: L('Administrador', 'Administrator') }]} value={nRole} onChange={(v) => setNRole(v as typeof nRole)} />
        {nRole === 'tienda' && stores ? <Pills label={L('Sucursal', 'Branch')} options={stores.map((s) => ({ v: s.id, label: s.nombre.replace('Castillo · ', ''), icon: 'store' }))} value={nStore} onChange={setNStore} /> : null}
        {nMsg ? <Note kind={nMsg.ok ? 'blue' : 'red'} icon={nMsg.ok ? 'check' : 'x'}>{nMsg.t}</Note> : null}
        <Btn icon="users" title={L('Crear cuenta', 'Create account')} onPress={crear} loading={nBusy} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <Card>
        <H2>{L('Cuentas', 'Accounts')}{all ? ` (${all.length})` : ''}</H2>
        <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por nombre, número de cliente o teléfono', 'Search by name, member number or phone')} count={q ? shownAll.length : undefined} />
        <Pills options={[{ v: 'all', label: L('Todas', 'All') }, { v: 'cliente', label: L('Clientes', 'Customers') }, { v: 'tienda', label: L('Tiendas', 'Stores') }, { v: 'admin', label: L('Administradores', 'Admins') }]} value={rf} onChange={(v) => setRf(v as typeof rf)} />
        {shownAll.slice(0, 60).map((p) => (
          <Pressable key={p.id} onPress={() => { setFound(p); setLookup(p.member_code || ''); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.7 : 1 })}>
            <Avatar name={`${p.nombre} ${p.apellidos}`} size={36} uri={p.foto_url} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={1}>{`${p.nombre} ${p.apellidos}`.trim() || L('(sin nombre)', '(no name)')}</Text>
              <P small muted>{[p.member_code, p.telefono, { cliente: L('Cliente', 'Customer'), tienda: L('Tienda', 'Store') + (p.store_id ? ' · ' + (stores || []).find((s) => s.id === p.store_id)?.nombre.replace('Castillo · ', '') : ''), admin: L('Administrador', 'Admin') }[p.role]].filter(Boolean).join(' · ')}</P>
            </View>
            <Text style={{ color: C.blue, fontWeight: '800' }}>{L('Ver', 'View')}</Text>
          </Pressable>
        ))}
        {shownAll.length > 60 ? <P small muted>{L(`Mostrando 60 de ${shownAll.length}. Usa el buscador.`, `Showing 60 of ${shownAll.length}. Use search.`)}</P> : null}
      </Card>

      <Card>
        <H2>{L('Buscar una cuenta', 'Find an account')}</H2>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={L('Número de cliente (CM-000000) o correo', 'Member number (CM-000000) or email')} value={lookup} onChangeText={setLookup} autoCapitalize="none" />
          <Btn kind="ghost" title={L('Buscar', 'Find')} onPress={find} disabled={!lookup.trim()} />
        </Row>
        {found ? (
          <View style={{ padding: 12, borderRadius: R.md, backgroundColor: C.cream, gap: 4 }}>
            <Text style={{ fontWeight: '900', color: C.ink }}>{`${found.nombre} ${found.apellidos}`} · {found.member_code}</Text>
            <P small muted>{L('Rol actual: ', 'Current role: ') + found.role} · {L('Identificación: ', 'ID: ') + found.id_status}</P>
            <P small>{L('Marca su identificación después de revisarla en persona:', 'Mark their ID after checking it in person:')}</P>
            <Row>
              <Btn small kind="blue" title={L('Verificada', 'Verified')} onPress={() => setId('verificada')} />
              <Btn small kind="danger" title={L('Rechazada', 'Rejected')} onPress={() => setId('rechazada')} />
              <Btn small kind="ghost" title={L('Sin verificar', 'Not verified')} onPress={() => setId('ninguna')} />
            </Row>
          </View>
        ) : null}
      </Card>

      <Card>
        <H2>{L('Asignar rol', 'Assign role')}</H2>
        <P small muted>{L('Para dar acceso a una tienda: la tienda crea su cuenta con "Crear mi cuenta" y aquí le asignas el rol "Tienda" y su sucursal.', 'To give a store access: the store creates its account with "Create my account" and here you assign the "Store" role and its branch.')}</P>
        <Pills options={[{ v: 'tienda', label: L('Tienda', 'Store') }, { v: 'admin', label: L('Administrador', 'Administrator') }, { v: 'cliente', label: L('Cliente', 'Customer') }]} value={role} onChange={(v) => setRole(v as typeof role)} />
        {role === 'tienda' && stores ? <Pills label={L('Sucursal', 'Branch')} options={stores.map((s) => ({ v: s.id, label: s.nombre.replace('Castillo · ', ''), icon: 'store' }))} value={store} onChange={setStore} /> : null}
        <Btn title={L('Asignar', 'Assign')} onPress={assign} loading={busy} disabled={!lookup.trim() || (role === 'tienda' && !store)} style={{ alignSelf: 'flex-start' }} />
      </Card>
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
    </Screen>
  );
}
