import React, { useState } from 'react';

import { PanelHeader } from '@/components/panel';
import { StoreForm } from '@/components/StoreForm';
import { Btn, Loading, Note, Pills, Row, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';

export default function AdminTiendas() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  if (!stores) return <Loading />;
  const st = stores.find((x) => x.id === sel) || stores[0];

  const add = async () => {
    setErr('');
    const { data, error } = await supabase
      .from('stores')
      .insert({ nombre: L('Castillo · Sucursal nueva', 'Castillo · New branch'), activo: false, orden: stores.length + 1 })
      .select('id')
      .single();
    if (error) setErr(errMsg(error));
    else {
      await reload();
      setSel(data.id);
    }
  };

  return (
    <Screen wide>
      <PanelHeader kind="admin" />
      <Row style={{ justifyContent: 'space-between' }}>
        <Pills options={stores.map((x) => ({ v: x.id, label: x.nombre.replace('Castillo · ', '') + (x.activo ? '' : L(' (oculta)', ' (hidden)')), icon: 'store' }))} value={st?.id} onChange={setSel} />
        <Btn small kind="ghost" icon="store" title={L('Agregar tienda', 'Add store')} onPress={add} />
      </Row>
      {err ? <Note kind="red">{err}</Note> : null}
      <Note kind="blue">{L('Para que una tienda entre a su panel, crea su cuenta (Registro) y asígnale el rol de tienda en "Cuentas".', 'For a store to use its panel, create its account (Sign up) and give it the store role in "Accounts".')}</Note>
      {st ? <StoreForm key={st.id} store={st} admin onSaved={reload} /> : null}
    </Screen>
  );
}
