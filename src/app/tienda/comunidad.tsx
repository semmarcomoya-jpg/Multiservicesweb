import React from 'react';

import { ComunidadPanel } from '@/components/ComunidadPanel';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { Empty, Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';

export default function TiendaComunidad() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  if (!stores) return <Loading />;
  return (
    <Screen wide>
      <PanelHeader kind="tienda" store={st} stores={stores} onStoreChange={reload} />
      {st ? <ComunidadPanel key={st.id} stores={stores} storeId={st.id} /> : <Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty>}
    </Screen>
  );
}
