import React from 'react';

import { ComunidadPanel } from '@/components/ComunidadPanel';
import { PanelHeader } from '@/components/panel';
import { Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';

export default function AdminComunidad() {
  const { data: stores } = useStores();
  return (
    <Screen wide>
      <PanelHeader kind="admin" />
      {stores ? <ComunidadPanel stores={stores} /> : <Loading />}
    </Screen>
  );
}
