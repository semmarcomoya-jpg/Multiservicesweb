import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { usePanelStore } from '@/components/panel';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Empty, Loading, matches, Note, P, Pills, Screen, SearchBox } from '@/components/ui';
import { useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Customer } from '@/lib/types';

type Sort = 'reciente' | 'gastado' | 'puntos' | 'nombre';

export default function Clientes() {
  const { L, lang } = useLang();
  const { data: stores } = useStores();
  const st = usePanelStore(stores);
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('reciente');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!st) return;
    supabase.rpc('store_customers', { p_store: st.id }).then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setRows((data as Customer[]) ?? []);
    });
  }, [st]);
  useFocusEffect(load);

  if (!stores || (st && !rows)) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const list = (rows || [])
    .filter((c) => matches(q, c.nombre, c.member_code, c.telefono))
    .sort((a, b) =>
      sort === 'gastado' ? Number(b.gastado) - Number(a.gastado) : sort === 'puntos' ? b.puntos - a.puntos : sort === 'nombre' ? a.nombre.localeCompare(b.nombre) : String(b.ultimo || '').localeCompare(String(a.ultimo || '')),
    );
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' }) : '—');

  return (
    <Screen wide>
      <P small muted>{L('Clientes que compraron aquí o eligieron esta tienda como favorita.', 'Customers who bought here or chose this store as favorite.')}</P>
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Buscar por nombre, número o teléfono', 'Search by name, number or phone')} count={list.length} />
      <Pills
        options={[
          { v: 'reciente' as Sort, label: L('Recientes', 'Recent') },
          { v: 'gastado' as Sort, label: L('Más compras', 'Top spend') },
          { v: 'puntos' as Sort, label: L('Más puntos', 'Most points') },
          { v: 'nombre' as Sort, label: L('Nombre', 'Name') },
        ]}
        value={sort}
        onChange={setSort}
      />
      {err ? <Note kind="red">{err}</Note> : null}
      {list.length ? (
        list.map((c) => (
          <Card key={c.user_id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar name={c.nombre} size={44} uri={c.foto_url} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '900', color: C.ink, fontSize: 15 }} numberOfLines={1}>
                  {c.nombre}
                  {c.favorita ? ' ★' : ''}
                </Text>
                <P small muted>
                  {c.member_code}
                  {c.telefono ? ' · ' + c.telefono : ''}
                  {' · '}
                  {c.id_status === 'verificada' ? L('ID verificada', 'ID verified') : c.id_status === 'pendiente' ? L('ID por revisar', 'ID to review') : L('Sin ID', 'No ID')}
                </P>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <P small><Text style={{ fontWeight: '900' }}>{c.pedidos}</Text> {L('pedidos', 'orders')}</P>
              <P small><Text style={{ fontWeight: '900' }}>{money(Number(c.gastado))}</Text> {L('comprado', 'spent')}</P>
              <P small><Text style={{ fontWeight: '900' }}>{c.puntos}</Text> pts</P>
              <P small>{L('Última visita ', 'Last visit ') + fmt(c.ultimo)}</P>
              {c.planes ? <P small style={{ fontWeight: '800', color: C.blueInk }}>{L(`${c.planes} crédito(s)`, `${c.planes} credit(s)`)}</P> : null}
              {c.credito_on ? <P small style={{ fontWeight: '800', color: '#1E5B35' }}>{L('Línea ', 'Line ') + money(Number(c.credito_limite))}</P> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn small kind="ghost" icon="store" title={L('Cobrar en mostrador', 'Charge at counter')} onPress={() => router.push({ pathname: '/tienda/mostrador', params: { code: c.member_code } } as never)} />
              <Btn small kind="ghost" icon="cash" title={L('Línea de crédito', 'Credit line')} onPress={() => router.push({ pathname: '/tienda/creditos', params: { code: c.member_code } } as never)} />
            </View>
          </Card>
        ))
      ) : (
        <Empty>{q ? L('Sin resultados.', 'No results.') : L('Aún no hay clientes en esta tienda.', 'No customers at this store yet.')}</Empty>
      )}
    </Screen>
  );
}
