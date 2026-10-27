import React from 'react';

import { PanelHeader, usePanelStore } from '@/components/panel';
import { StoriesAdmin } from '@/components/StoriesAdmin';
import { Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';

export default function TiendaHistorias() {
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  if (!stores) return <Loading />;
  return (
    <Screen wide>
      <PanelHeader kind="tienda" store={st} stores={stores} onStoreChange={reload} />
      {st ? <StoriesAdmin key={st.id} storeId={st.id} admin={false} stores={stores} /> : null}
    </Screen>
  );
}
