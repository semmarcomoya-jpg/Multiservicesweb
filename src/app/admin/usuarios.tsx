import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { StoreChecks, storesLabel } from '@/components/StoreChecks';
import { Avatar, Btn, Card, Field, H2, Note, P, Pills, Row, Screen, SearchBox, matches } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { createAccount, errMsg, supabase } from '@/lib/supabase';
import { digits } from '@/lib/format';
import { C, R } from '@/lib/theme';
import type { Profile, Role } from '@/lib/types';

const idsOf = (p: Profile) => (p.store_ids && p.store_ids.length ? p.store_ids : p.store_id && p.role === 'tienda' ? [p.store_id] : []);

export default function AdminUsuarios() {
  const { L, lang } = useLang();
  const { session } = useAuth();
  const { data: stores } = useStores();
  // Crear cuenta
  const [showNew, setShowNew] = useState(false);
  const [n, setN] = useState({ nombre: '', apellidos: '', email: '', telefono: '', pass: '' });
  const [nRole, setNRole] = useState<Role>('cliente');
  const [nStores, setNStores] = useState<string[]>([]);
  const [nBusy, setNBusy] = useState(false);
  const [nMsg, setNMsg] = useState<{ ok: boolean; t: string } | null>(null);
  // Lista
  const [all, setAll] = useState<Profile[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [rf, setRf] = useState<'all' | Role>('all');
  const [loadErr, setLoadErr] = useState('');
  // Cuenta abierta
  const [open, setOpen] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('cliente');
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const loadAll = useCallback(() => {
    // Si algo falla se muestra el motivo en pantalla (antes la lista salía vacía sin decir nada)
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(3000).then(({ data, error }) => {
      setLoadErr(error ? errMsg(error) : '');
      setAll((data as Profile[]) ?? []);
    }, (e) => { setLoadErr(errMsg(e)); setAll([]); });
    supabase.rpc('admin_account_emails').then(({ data }) => setEmails(Object.fromEntries(((data as { id: string; email: string }[]) ?? []).map((r) => [r.id, r.email]))), () => {});
  }, []);
  useFocusEffect(loadAll);
  useEffect(() => {
    if (nRole === 'tienda' && !nStores.length && stores?.length === 1) setNStores([stores[0].id]);
  }, [nRole, nStores.length, stores]);

  const roleName = (r: Role) => ({ cliente: L('Cliente', 'Customer'), tienda: L('Personal de tienda', 'Store staff'), admin: L('Administrador', 'Administrator') })[r];
  const ROLES = [
    { v: 'cliente' as Role, label: roleName('cliente') },
    { v: 'tienda' as Role, label: roleName('tienda') },
    { v: 'admin' as Role, label: roleName('admin') },
  ];

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
    if (nRole === 'tienda' && !nStores.length) return setNMsg({ ok: false, t: L('Elige al menos una sucursal.', 'Choose at least one branch.') });
    setNBusy(true);
    try {
      const r = await createAccount({ email, password: n.pass, nombre: n.nombre.trim(), apellidos: n.apellidos.trim(), telefono: digits(n.telefono), idioma: lang });
      if (nRole !== 'cliente') {
        // La cuenta recién creada se busca por su correo
        const { data: em } = await supabase.rpc('admin_account_emails');
        const id = ((em as { id: string; email: string }[]) ?? []).find((x) => x.email?.toLowerCase() === email)?.id;
        if (!id) throw new Error(L('La cuenta se creó, pero no pudimos asignarle el acceso. Búscala en la lista y asígnalo.', 'Account created but access could not be set. Find it in the list and assign it.'));
        const { error } = await supabase.rpc('admin_set_access', { p_user: id, p_role: nRole, p_stores: nRole === 'tienda' ? nStores : [] });
        if (error) throw error;
      }
      setNMsg({
        ok: true,
        t:
          L(`Cuenta creada para ${email}. Contraseña: ${n.pass}. `, `Account created for ${email}. Password: ${n.pass}. `) +
          (r.needsConfirm ? L('Le llegará un correo para activarla antes de entrar.', 'They will get an email to activate it before signing in.') : L('Ya puede entrar.', 'They can sign in now.')),
      });
      setN({ nombre: '', apellidos: '', email: '', telefono: '', pass: '' });
      setNStores([]);
      loadAll();
    } catch (e) {
      setNMsg({ ok: false, t: errMsg(e) });
    }
    setNBusy(false);
  };

  const openAcc = (p: Profile) => {
    if (open === p.id) return setOpen(null);
    setOpen(p.id);
    setRole(p.role);
    setSel(idsOf(p));
    setMsg(null);
  };

  const saveAccess = async (p: Profile) => {
    setMsg(null);
    if (role === 'tienda' && !sel.length) return setMsg({ ok: false, t: L('Elige al menos una sucursal.', 'Choose at least one branch.') });
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_access', { p_user: p.id, p_role: role, p_stores: role === 'tienda' ? sel : [] });
    setBusy(false);
    if (error) return setMsg({ ok: false, t: errMsg(error) });
    setAll((list) => (list || []).map((x) => (x.id === p.id ? { ...x, role, store_ids: role === 'tienda' ? sel : [], store_id: role === 'tienda' ? sel[0] : x.store_id } : x)));
    setMsg({ ok: true, t: L('Acceso guardado. Si la persona tiene la app abierta, que cierre sesión y vuelva a entrar.', 'Access saved. If they have the app open, they should sign out and back in.') });
  };

  const setId = async (p: Profile, st: Profile['id_status']) => {
    const { error } = await supabase.from('profiles').update({ id_status: st }).eq('id', p.id);
    if (error) return setMsg({ ok: false, t: errMsg(error) });
    setAll((list) => (list || []).map((x) => (x.id === p.id ? { ...x, id_status: st } : x)));
    setMsg({ ok: true, t: L('Estado de identificación actualizado.', 'ID status updated.') });
  };

  const counts = { all: all?.length || 0, cliente: 0, tienda: 0, admin: 0 } as Record<string, number>;
  (all || []).forEach((p) => (counts[p.role] = (counts[p.role] || 0) + 1));
  const shownAll = (all || []).filter((p) => (rf === 'all' || p.role === rf) && matches(q, p.nombre, p.apellidos, p.member_code, p.telefono, emails[p.id]));
  const st = stores || [];

  return (
    <Screen wide>
      <Row style={{ justifyContent: 'space-between' }}>
        <P muted style={{ flex: 1, minWidth: 220 }}>
          {L('Toca una cuenta para cambiar su acceso: cliente, personal de tienda (en una o varias sucursales) o administrador.', 'Tap an account to change its access: customer, store staff (one or several branches) or administrator.')}
        </P>
        <Btn icon="plus" title={showNew ? L('Cerrar', 'Close') : L('Crear una cuenta', 'Create an account')} kind={showNew ? 'ghost' : 'primary'} onPress={() => { setShowNew(!showNew); setNMsg(null); }} />
      </Row>

      {showNew ? (
        <Card style={{ borderColor: C.gold, borderWidth: 2 }}>
          <H2>{L('Crear una cuenta', 'Create an account')}</H2>
          <P small muted>{L('Para el personal de una tienda o para un cliente que no sabe registrarse. Los clientes también pueden registrarse solos con "Crear mi cuenta".', 'For store staff, or for a customer who cannot sign up. Customers can also sign up on their own with "Create my account".')}</P>
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={L('Nombre', 'First name')} value={n.nombre} onChangeText={(v) => setN((x) => ({ ...x, nombre: v }))} />
            <Field label={L('Apellidos', 'Last name')} value={n.apellidos} onChangeText={(v) => setN((x) => ({ ...x, apellidos: v }))} />
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={L('Correo', 'Email')} value={n.email} onChangeText={(v) => setN((x) => ({ ...x, email: v }))} autoCapitalize="none" keyboardType="email-address" />
            <Field label={L('Teléfono', 'Phone')} value={n.telefono} onChangeText={(v) => setN((x) => ({ ...x, telefono: digits(v) }))} keyboardType="phone-pad" maxLength={10} />
          </Row>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={L('Contraseña temporal (mín. 8)', 'Temporary password (min. 8)')} value={n.pass} onChangeText={(v) => setN((x) => ({ ...x, pass: v }))} autoCapitalize="none" style={{ maxWidth: 320 }} />
            <Btn small kind="ghost" title={L('Generar', 'Generate')} onPress={genPass} />
          </Row>
          <Pills label={L('Tipo de cuenta', 'Account type')} options={ROLES} value={nRole} onChange={setNRole} />
          {nRole === 'tienda' ? <StoreChecks stores={st} value={nStores} onChange={setNStores} /> : null}
          {nMsg ? <Note kind={nMsg.ok ? 'blue' : 'red'} icon={nMsg.ok ? 'check' : 'x'}>{nMsg.t}</Note> : null}
          <Btn icon="users" title={L('Crear cuenta', 'Create account')} onPress={crear} loading={nBusy} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}

      <Card>
        <H2>{L('Cuentas', 'Accounts')}{all ? ` (${all.length})` : ''}</H2>
        {loadErr ? <Note kind="red" icon="x">{L('No se pudieron cargar las cuentas: ', 'Could not load accounts: ') + loadErr}</Note> : null}
        {!all ? <P muted>{L('Cargando cuentas…', 'Loading accounts…')}</P> : null}
        <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por nombre, correo, número de cliente o teléfono', 'Search by name, email, member number or phone')} count={q ? shownAll.length : undefined} />
        <Pills
          options={[
            { v: 'all' as const, label: L(`Todas (${counts.all})`, `All (${counts.all})`) },
            { v: 'tienda' as const, label: L(`Personal (${counts.tienda || 0})`, `Staff (${counts.tienda || 0})`) },
            { v: 'admin' as const, label: L(`Administradores (${counts.admin || 0})`, `Admins (${counts.admin || 0})`) },
            { v: 'cliente' as const, label: L(`Clientes (${counts.cliente || 0})`, `Customers (${counts.cliente || 0})`) },
          ]}
          value={rf}
          onChange={setRf}
        />
        {shownAll.slice(0, 80).map((p) => {
          const isOpen = open === p.id;
          const where = p.role === 'tienda' ? storesLabel(idsOf(p), st, L('Todas las sucursales', 'All branches')) : '';
          return (
            <View key={p.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => openAcc(p)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: pressed ? 0.7 : 1 })}>
                <Avatar name={`${p.nombre} ${p.apellidos}`} size={38} uri={p.foto_url} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={1}>{`${p.nombre} ${p.apellidos}`.trim() || L('(sin nombre)', '(no name)')}</Text>
                  <P small muted>{[emails[p.id], p.member_code].filter(Boolean).join(' · ')}</P>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '45%' }}>
                  <Text style={{ fontWeight: '900', fontSize: 12, color: p.role === 'admin' ? C.red : p.role === 'tienda' ? C.blueInk : C.muted }}>{roleName(p.role)}</Text>
                  {where ? <P small muted style={{ textAlign: 'right' }}>{where}</P> : null}
                </View>
              </Pressable>
              {isOpen ? (
                <View style={{ padding: 12, marginBottom: 10, borderRadius: R.md, backgroundColor: C.cream, gap: 10 }}>
                  <Pills label={L('Acceso', 'Access')} options={ROLES} value={role} onChange={setRole} />
                  {role === 'tienda' ? <StoreChecks stores={st} value={sel} onChange={setSel} /> : null}
                  {role === 'admin' ? <P small muted>{L('Ve y administra todas las sucursales.', 'Sees and manages every branch.')}</P> : null}
                  <Row>
                    <Btn icon="check" title={L('Guardar acceso', 'Save access')} loading={busy} onPress={() => saveAccess(p)} disabled={p.id === session?.user.id && role !== 'admin'} />
                    <Btn kind="ghost" title={L('Cerrar', 'Close')} onPress={() => setOpen(null)} />
                  </Row>
                  {p.id === session?.user.id ? <P small muted>{L('Esta es tu cuenta: no puedes quitarte el acceso de administrador.', 'This is your account: you cannot remove your own admin access.')}</P> : null}
                  {p.role === 'cliente' ? (
                    <View style={{ gap: 6 }}>
                      <P small>{L('Identificación (después de revisarla en persona): ', 'ID (after checking it in person): ')}<Text style={{ fontWeight: '900' }}>{p.id_status}</Text></P>
                      <Row>
                        <Btn small kind="blue" title={L('Verificada', 'Verified')} onPress={() => setId(p, 'verificada')} />
                        <Btn small kind="danger" title={L('Rechazada', 'Rejected')} onPress={() => setId(p, 'rechazada')} />
                        <Btn small kind="ghost" title={L('Sin verificar', 'Not verified')} onPress={() => setId(p, 'ninguna')} />
                      </Row>
                    </View>
                  ) : null}
                  {msg ? <Note kind={msg.ok ? 'blue' : 'red'} icon={msg.ok ? 'check' : 'x'}>{msg.t}</Note> : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {shownAll.length > 80 ? <P small muted>{L(`Mostrando 80 de ${shownAll.length}. Usa el buscador.`, `Showing 80 of ${shownAll.length}. Use search.`)}</P> : null}
      </Card>
    </Screen>
  );
}
