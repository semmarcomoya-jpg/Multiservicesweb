import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PanelHeader } from '@/components/panel';
import { Btn, Card, H2, IcoBox, Loading, P, Row, Screen } from '@/components/ui';
import { useCategories, useServices } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { Service } from '@/lib/types';

export default function AdminServicios() {
  const { L, nm } = useLang();
  const { data: services, reload } = useServices();
  const { data: cats } = useCategories();
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!services || !cats) return <Loading />;

  const price = (sv: Service) =>
    sv.price_type === 'fixed' ? money(sv.base) : sv.price_type === 'options' ? L(`${sv.options.length} opciones`, `${sv.options.length} options`) : L('Monto libre', 'Any amount');

  return (
    <Screen wide>
      <PanelHeader kind="admin" />
      <Row style={{ justifyContent: 'space-between' }}>
        <P muted style={{ flex: 1 }}>{L('Tú defines el catálogo. El cliente solo elige un servicio y llena los datos que tú pides.', 'You define the catalog. Customers pick a service and fill in the fields you ask for.')}</P>
        <Btn icon="tool" title={L('Agregar servicio', 'Add service')} onPress={() => router.push({ pathname: '/admin/servicio/[id]', params: { id: 'nuevo' } })} />
      </Row>
      {cats.map((c) => {
        const list = services.filter((x) => x.cat_id === c.id);
        if (!list.length) return null;
        return (
          <Card key={c.id}>
            <Row gap={8}>
              <IcoBox n={c.icon} size={30} />
              <H2>{nm(c)}</H2>
            </Row>
            {list.map((sv) => (
              <Pressable key={sv.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/admin/servicio/[id]', params: { id: sv.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: C.cream }}>
                <IcoBox n={sv.icon} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '900', color: C.ink }}>{nm(sv)}</Text>
                  <P small muted>{price(sv)} · {(sv.fields || []).length} {L('datos', 'fields')}</P>
                </View>
                <Text style={{ fontWeight: '800', color: sv.activo ? '#1E5B35' : C.muted }}>{sv.activo ? L('Visible', 'Visible') : L('Oculto', 'Hidden')}</Text>
              </Pressable>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
