import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { PanelHeader } from '@/components/panel';
import { Btn, Card, Field, H2, Note, P, Pills, Row, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function AdminUsuarios() {
  const { L } = useLang();
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

  return (
    <Screen wide>
      <PanelHeader kind="admin" />
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
