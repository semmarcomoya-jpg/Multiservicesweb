import React from 'react';

import { PanelHeader } from '@/components/panel';
import { StoriesAdmin } from '@/components/StoriesAdmin';
import { Loading, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';

export default function AdminHistorias() {
  const { data: stores } = useStores();
  if (!stores) return <Loading />;
  return (
    <Screen wide>
      <StoriesAdmin storeId={null} admin stores={stores} />
    </Screen>
  );
}
