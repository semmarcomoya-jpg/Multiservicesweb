import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

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
type Show = 'all' | 'bday' | 'away';
const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Clientes() {
  const { L, lang } = useLang();
  const { data: stores } = useStores();
  const st = usePanelStore(stores);
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('reciente');
  const [show, setShow] = useState<Show>('all');
  const [err, setErr] = useState('');
  const [lowRates, setLowRates] = useState(0);

  const load = useCallback(() => {
    if (!st) return;
    supabase.rpc('store_customers', { p_store: st.id }).then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setRows((data as Customer[]) ?? []);
    });
    supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('store_id', st.id).lte('stars', 2).eq('followed_up', false).then(({ count }) => setLowRates(count || 0));
  }, [st]);
  useFocusEffect(load);

  if (!stores || (st && !rows)) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const today = mmdd(new Date());
  const month = today.slice(0, 2);
  const isBday = (c: Customer) => !!c.cumple && c.cumple.slice(0, 2) === month;
  // "No ha vuelto": compró al menos 2 veces y su última visita fue hace más de 30 días
  const isAway = (c: Customer) => Number(c.pedidos) >= 2 && !!c.ultimo && Date.now() - new Date(c.ultimo).getTime() > 30 * 86400000;
  const nB = (rows || []).filter(isBday).length, nA = (rows || []).filter(isAway).length;
  const list = (rows || [])
    .filter((c) => (show === 'all' || (show === 'bday' ? isBday(c) : isAway(c))) && matches(q, c.nombre, c.member_code, c.telefono))
    .sort((a, b) =>
      sort === 'gastado' ? Number(b.gastado) - Number(a.gastado) : sort === 'puntos' ? b.puntos - a.puntos : sort === 'nombre' ? a.nombre.localeCompare(b.nombre) : String(b.ultimo || '').localeCompare(String(a.ultimo || '')),
    );
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' }) : '—');

  return (
    <Screen wide>
      <P small muted>{L('Clientes que compraron aquí o eligieron esta tienda como favorita.', 'Customers who bought here or chose this store as favorite.')}</P>
      {(() => {
        const wa = (c: Customer, msgEs: string, msgEn: string) => {
          const t = (c.telefono || '').replace(/\D/g, '').slice(-10);
          if (t) void Linking.openURL(`https://wa.me/1${t}?text=${encodeURIComponent(lang === 'es' ? msgEs : msgEn)}`);
        };
        const store = st.nombre.replace('Castillo · ', '');
        const bdays = (rows || []).filter((c) => c.cumple === today);
        const away = (rows || []).filter(isAway).slice(0, 5);
        const first = (n: string) => n.split(' ')[0];
        const row = (c: Customer, sub: string, btn: string, onPress: () => void, primary = false) => (
          <View key={c.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Avatar name={c.nombre} size={38} uri={c.foto_url} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={1}>{c.nombre}</Text>
              <P small muted>{sub}</P>
            </View>
            <Btn small kind={primary ? 'primary' : 'ghost'} title={btn} onPress={onPress} disabled={!c.telefono} />
          </View>
        );
        if (!bdays.length && !away.length && !lowRates) return null;
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {bdays.length ? (
              <Card style={{ flexGrow: 1, flexBasis: 300 }}>
                <Text style={{ fontWeight: '900', color: C.ink }}>{L('Cumplen hoy 🎂', 'Birthdays today 🎂')}</Text>
                {bdays.map((c) => row(c, L('Mándale una felicitación', 'Send a greeting'), L('Felicitar', 'Greet'), () => wa(c, `¡Feliz cumpleaños, ${first(c.nombre)}! De parte de todos en ${store}. Pasa por tu regalo 🎁`, `Happy birthday, ${first(c.nombre)}! From everyone at ${store}. Come get your gift 🎁`), true))}
              </Card>
            ) : null}
            {away.length ? (
              <Card style={{ flexGrow: 1, flexBasis: 300 }}>
                <Text style={{ fontWeight: '900', color: C.ink }}>{L('No vienen hace 30 días', 'Not back in 30 days')}</Text>
                {away.map((c) => row(c, L(`Última vez ${fmt(c.ultimo)} · ${c.pedidos} pedidos`, `Last time ${fmt(c.ultimo)} · ${c.pedidos} orders`), L('Escribirle', 'Message'), () => wa(c, `¡Hola ${first(c.nombre)}! Te extrañamos en ${store}. Esta semana te esperamos con el mejor tipo de cambio.`, `Hi ${first(c.nombre)}! We miss you at ${store}. Come by this week for our best rate.`)))}
              </Card>
            ) : null}
            {lowRates ? (
              <Card style={{ flexGrow: 1, flexBasis: 300 }}>
                <Text style={{ fontWeight: '900', color: C.ink }}>{L('Calificaciones para dar seguimiento', 'Ratings to follow up')}</Text>
                <P small muted>{L(`${lowRates} clientes calificaron con 1 o 2 estrellas y nadie les ha respondido.`, `${lowRates} customers gave 1–2 stars and nobody has followed up.`)}</P>
                <Btn small icon="star" title={L('Responder', 'Reply')} onPress={() => router.push('/tienda/calificaciones')} style={{ alignSelf: 'flex-start' }} />
              </Card>
            ) : null}
          </View>
        );
      })()}
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Buscar por nombre, número o teléfono', 'Search by name, number or phone')} count={list.length} />
      <Pills
        options={[
          { v: 'all' as Show, label: L(`Todos (${rows?.length || 0})`, `All (${rows?.length || 0})`) },
          { v: 'bday' as Show, label: L(`Cumplen este mes (${nB})`, `Birthdays this month (${nB})`), icon: 'party' },
          { v: 'away' as Show, label: L(`No han vuelto en 30 días (${nA})`, `Not back in 30 days (${nA})`), icon: 'clock' },
        ]}
        value={show}
        onChange={setShow}
      />
      {show === 'away' && nA ? <Note kind="gold" icon="chat">{L('Mándales un WhatsApp o un aviso con una promoción para que regresen.', 'Send them a WhatsApp or a promo to bring them back.')}</Note> : null}
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
                  {c.cumple === today ? L(' · 🎂 ¡cumple hoy!', ' · 🎂 birthday today!') : isBday(c) ? ` · 🎂 ${Number(c.cumple!.slice(3))}/${Number(month)}` : ''}
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
