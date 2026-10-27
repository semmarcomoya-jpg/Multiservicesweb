import React from 'react';

import { CalificacionesPanel } from '@/components/CalificacionesPanel';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { Empty, Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';

export default function TiendaCalificaciones() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  if (!stores) return <Loading />;
  return (
    <Screen wide>
      {st ? <CalificacionesPanel key={st.id} stores={stores} storeId={st.id} /> : <Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty>}
    </Screen>
  );
}
