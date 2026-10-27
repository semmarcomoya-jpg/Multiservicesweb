import React from 'react';

import { CalificacionesPanel } from '@/components/CalificacionesPanel';
import { PanelHeader } from '@/components/panel';
import { Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';

export default function AdminCalificaciones() {
  const { data: stores } = useStores();
  return (
    <Screen wide>
      {stores ? <CalificacionesPanel stores={stores} /> : <Loading />}
    </Screen>
  );
}
