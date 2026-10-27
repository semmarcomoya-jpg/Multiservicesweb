import React from 'react';

import { PanelHeader, usePanelStore } from '@/components/panel';
import { StoreForm } from '@/components/StoreForm';
import { Empty, Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';

export default function MiTienda() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  if (!stores) return <Loading />;
  return (
    <Screen wide>
      {st ? <StoreForm key={st.id} store={st} onSaved={reload} /> : <Empty>{L('Esta cuenta no tiene tienda asignada. Pide al administrador que la asigne.', 'This account has no store assigned. Ask the administrator.')}</Empty>}
    </Screen>
  );
}
