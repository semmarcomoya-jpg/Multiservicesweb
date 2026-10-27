import React from 'react';

import { Bitacora } from '@/components/Bitacora';
import { PanelHeader } from '@/components/panel';
import { Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';

export default function AdminBitacora() {
  const { data: stores } = useStores();
  return (
    <Screen wide>
      <PanelHeader kind="admin" />
      {stores ? <Bitacora stores={stores} /> : <Loading />}
    </Screen>
  );
}
