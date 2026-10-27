import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { BackBar, Btn, Card, Empty, H1, IcoBox, Loading, P, Row, Screen } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Beneficiary } from '@/lib/types';

export default function Beneficiarios() {
  const { L } = useLang();
  const [list, setList] = useState<Beneficiary[] | null>(null);
  const load = useCallback(() => {
    supabase
      .from('beneficiaries')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setList((data as Beneficiary[]) ?? []));
  }, []);
  useFocusEffect(load);

  const remove = async (id: string) => {
    await supabase.from('beneficiaries').delete().eq('id', id);
    load();
  };

  return (
    <Screen>
      <BackBar title={L('Mis beneficiarios', 'My recipients')} />
      <H1>{L('¿A quién le envías?', 'Who do you send to?')}</H1>
      <Btn icon="users" title={L('Agregar beneficiario', 'Add recipient')} onPress={() => router.push('/beneficiarios/nuevo')} />
      {!list ? <Loading /> : null}
      {list && list.length === 0 ? <Empty>{L('Aún no tienes beneficiarios.', 'No recipients yet.')}</Empty> : null}
      {(list || []).map((b) => (
        <Card key={b.id}>
          <Row gap={12} style={{ flexWrap: 'nowrap' }}>
            <IcoBox n={b.metodo === 'cuenta' ? 'bank' : 'cash'} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>{`${b.nombre} ${b.apellidos}`.trim()}</Text>
              <P small muted>
                {[b.parentesco, b.ciudad && `${b.ciudad}, ${b.estado}`].filter(Boolean).join(' · ')}
              </P>
              <P small muted>{b.metodo === 'cuenta' ? `${b.banco} ···${b.cuenta.slice(-4)}` : L('Retiro en efectivo · ', 'Cash pickup · ') + b.red}</P>
            </View>
          </Row>
          <Btn small kind="danger" title={L('Quitar', 'Remove')} onPress={() => remove(b.id)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}
    </Screen>
  );
}
