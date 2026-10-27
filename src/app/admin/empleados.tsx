import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';

import { PanelHeader } from '@/components/panel';
import { Btn, Card, Field, H2, Loading, Note, P, Pills, Row, Screen, Toggle, SearchBox, matches } from '@/components/ui';
import { useStores } from '@/lib/data';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Employee } from '@/lib/types';

interface Draft { id: string | null; nombre: string; store: string; rol: 'tienda' | 'admin'; activo: boolean; pin: string }

export default function AdminEmpleados() {
  const { L } = useLang();
  const { data: stores } = useStores();
  const [list, setList] = useState<Employee[] | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, store_id, nombre, rol, activo').order('nombre');
    setList((data as Employee[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!list || !stores) return <Loading />;
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.nombre.replace('Castillo · ', '') || L('Todas', 'All');

  const save = async () => {
    if (!d) return;
    setErr('');
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_employee', {
      p_id: d.id,
      p_nombre: d.nombre.trim(),
      p_store: d.rol === 'admin' ? null : d.store,
      p_rol: d.rol,
      p_activo: d.activo,
      p_pin: d.pin ? d.pin : null,
    });
    setBusy(false);
    if (error) setErr(errMsg(error));
    else {
      setD(null);
      load();
    }
  };

  const pinOk = d ? (d.id ? !d.pin || /^\d{4,6}$/.test(d.pin) : /^\d{4,6}$/.test(d.pin)) : false;

  // El mismo formulario sirve para agregar (arriba) y para editar (justo debajo del empleado que tocaste)
  const form = d ? (
        <Card>
      <H2>{d.id ? L('Editar empleado', 'Edit employee') : L('Empleado nuevo', 'New employee')}</H2>
      <Row style={{ alignItems: 'flex-start' }}>
        <Field label={L('Nombre (lo ve el cliente)', 'Name (customers see it)')} value={d.nombre} onChangeText={(v) => setD({ ...d, nombre: v })} />
        <Field label={d.id ? L('Nueva clave (vacío = no cambiar)', 'New code (empty = keep)') : L('Clave (4 a 6 dígitos)', 'Code (4 to 6 digits)')} value={d.pin} onChangeText={(v) => setD({ ...d, pin: digits(v) })} keyboardType="number-pad" maxLength={6} secure />
      </Row>
      <Pills label={L('Rol', 'Role')} options={[{ v: 'tienda', label: L('Tienda', 'Store') }, { v: 'admin', label: L('Administrador', 'Administrator') }]} value={d.rol} onChange={(v) => setD({ ...d, rol: v as Draft['rol'] })} />
      {d.rol === 'tienda' ? <Pills label={L('Sucursal', 'Branch')} options={stores.map((s) => ({ v: s.id, label: s.nombre.replace('Castillo · ', ''), icon: 'store' }))} value={d.store} onChange={(v) => setD({ ...d, store: v })} /> : null}
      <Toggle label={L('Activo', 'Active')} value={d.activo} onChange={(v) => setD({ ...d, activo: v })} />
      {err ? <Note kind="red">{err}</Note> : null}
      <Row>
        <Btn title={L('Guardar', 'Save')} onPress={save} loading={busy} disabled={!d.nombre.trim() || !pinOk} />
        <Btn kind="ghost" title={L('Cancelar', 'Cancel')} onPress={() => setD(null)} />
      </Row>
    </Card>
  ) : null;

  return (
    <Screen wide>
      <Note kind="blue" icon="shield">
        {L('Cada empleado tiene su clave. La escribe al tomar un pedido; así sabes quién atendió y el cliente ve su nombre. Las claves se guardan cifradas: nadie puede verlas, solo cambiarlas.', 'Each employee has their own code, entered when taking an order, so you know who helped and the customer sees their name. Codes are stored encrypted: nobody can view them, only change them.')}
      </Note>
      <Btn icon="users" title={L('Agregar empleado', 'Add employee')} style={{ alignSelf: 'flex-start' }} onPress={() => setD({ id: null, nombre: '', store: stores[0]?.id || '', rol: 'tienda', activo: true, pin: '' })} />

      {d && !d.id ? form : null}

      <Card>
        <H2>{L('Empleados', 'Staff')}</H2>
        {list.length > 5 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por nombre o sucursal', 'Search by name or branch')} /> : null}
        {list.filter((e) => matches(q, e.nombre, storeName(e.store_id))).map((e) => (
          <View key={e.id} style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between', padding: 10, borderRadius: R.md, backgroundColor: d?.id === e.id ? C.blueSoft : C.cream, flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: e.activo ? C.ink : C.muted }}>{e.nombre}</Text>
              <P small muted>{e.rol === 'admin' ? L('Administrador', 'Administrator') : storeName(e.store_id)}{e.activo ? '' : L(' · inactivo', ' · inactive')}</P>
            </View>
            {d?.id === e.id ? (
              <Btn small kind="ghost" title={L('Cerrar', 'Close')} onPress={() => setD(null)} />
            ) : (
              <Btn small kind="ghost" title={L('Editar', 'Edit')} onPress={() => { setErr(''); setD({ id: e.id, nombre: e.nombre, store: e.store_id || stores[0]?.id || '', rol: e.rol, activo: e.activo, pin: '' }); }} />
            )}
          </Row>
          {d?.id === e.id ? form : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
