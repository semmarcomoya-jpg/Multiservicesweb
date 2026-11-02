import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Platform, View } from 'react-native';

import { usePanelStore } from '@/components/panel';
import { Text } from '@/components/Text';
import { Card, Empty, Field, H2, Loading, P, Pills, Row, Screen } from '@/components/ui';
import { useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order } from '@/lib/types';

type Per = '7' | '30' | 'mes';
const DAY = 86400000;
const KIND = { send: ['Envíos', 'Transfers'], service: ['Servicios', 'Services'], shop: ['Tienda', 'Shop'], abono: ['Abonos', 'Payments'] } as const;

function range(p: Per, now = new Date()) {
  if (p === 'mes') {
    const a = new Date(now.getFullYear(), now.getMonth(), 1);
    const pa = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Mismo número de días del mes anterior para comparar parejo
    const pb = new Date(pa.getTime() + (now.getTime() - a.getTime()));
    return { a, b: now, pa, pb };
  }
  const n = +p * DAY;
  return { a: new Date(now.getTime() - n), b: now, pa: new Date(now.getTime() - 2 * n), pb: new Date(now.getTime() - n) };
}
const goalKey = (id: string) => 'castillo.meta.' + id;
const readGoal = (id: string) => {
  try {
    return Platform.OS === 'web' ? localStorage.getItem(goalKey(id)) || '' : '';
  } catch {
    return '';
  }
};

export default function Estadisticas() {
  const { L, lang, nm } = useLang();
  const { data: stores } = useStores();
  const st = usePanelStore(stores);
  const [per, setPer] = useState<Per>('30');
  const [rows, setRows] = useState<Order[] | null>(null);
  const [mes, setMes] = useState<Order[]>([]);
  const [goal, setGoal] = useState('');
  const [d28, setD28] = useState<Order[]>([]);

  const load = useCallback(() => {
    if (!st) return;
    setGoal(readGoal(st.id));
    const r = range(per);
    const base = () => supabase.from('orders').select('*').eq('store_id', st.id).not('paid_at', 'is', null).neq('status', 'rechazado');
    base().gte('paid_at', r.pa.toISOString()).lte('paid_at', r.b.toISOString()).limit(5000).then(({ data }) => setRows((data as Order[]) ?? []));
    const now = new Date();
    base().gte('paid_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()).limit(5000).then(({ data }) => setMes((data as Order[]) ?? []));
    base().gte('paid_at', new Date(Date.now() - 28 * DAY).toISOString()).limit(5000).then(({ data }) => setD28((data as Order[]) ?? []));
  }, [st, per]);
  useFocusEffect(load);

  if (!stores) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const r = range(per);
  const paid = (o: Order) => new Date((o as Order & { paid_at?: string }).paid_at || o.created_at).getTime();
  const cur = (rows || []).filter((o) => paid(o) >= r.a.getTime());
  const prev = (rows || []).filter((o) => paid(o) >= r.pa.getTime() && paid(o) < r.pb.getTime());
  const sum = (l: Order[]) => l.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const tot = sum(cur), ptot = sum(prev);
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  const avg = cur.length ? tot / cur.length : 0;
  const pavg = prev.length ? ptot / prev.length : 0;

  const byKind = (Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => ({ k, n: cur.filter((o) => o.kind === k).length, t: sum(cur.filter((o) => o.kind === k)) })).filter((x) => x.n);
  const maxKind = Math.max(1, ...byKind.map((x) => x.t));
  const top: Record<string, { name: string; n: number; t: number }> = {};
  cur.forEach((o) => {
    const name = o.kind === 'send' ? L('Envío de dinero', 'Money transfer') : o.service_name ? nm(o.service_name) : KIND[o.kind]?.[lang === 'es' ? 0 : 1] || o.kind;
    const t = (top[name] = top[name] || { name, n: 0, t: 0 });
    t.n++;
    t.t += Number(o.total) || 0;
  });
  const tops = Object.values(top).sort((a, b) => b.t - a.t).slice(0, 6);

  // Mapa de calor: día de la semana × hora
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  cur.forEach((o) => {
    const d = new Date(paid(o));
    heat[d.getDay()][d.getHours()]++;
  });
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 am a 9 pm
  const maxHeat = Math.max(1, ...heat.flat());
  const days = lang === 'es' ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Meta del mes
  const meta = Number(goal) || 0;
  const mesTot = sum(mes);
  const now = new Date();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const proj = (mesTot / Math.max(1, now.getDate())) * dim;
  const pct = meta ? Math.min(100, Math.round((mesTot / meta) * 100)) : 0;
  const saveGoal = (v: string) => {
    const x = v.replace(/[^0-9]/g, '');
    setGoal(x);
    try {
      if (Platform.OS === 'web') localStorage.setItem(goalKey(st.id), x);
    } catch {}
  };

  const Kpi = ({ t, v, d }: { t: string; v: string; d?: number }) => (
    <View style={{ flex: 1, minWidth: 150, padding: 14, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 4 }}>
      <P small muted>{t}</P>
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{v}</Text>
      {d !== undefined ? (
        <Text style={{ fontSize: 12, fontWeight: '800', color: d >= 0 ? C.blueInk : C.red }}>
          {(d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% ' + L('vs. periodo anterior', 'vs. previous period')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen wide>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{L('Estadísticas', 'Statistics')}</H2>
        <Pills options={[{ v: '7' as Per, label: L('7 días', '7 days') }, { v: '30' as Per, label: L('30 días', '30 days') }, { v: 'mes' as Per, label: L('Este mes', 'This month') }]} value={per} onChange={setPer} />
      </Row>
      {!rows ? <Loading /> : (
        <>
          <Row style={{ alignItems: 'stretch' }}>
            <Kpi t={L('Vendido', 'Sold')} v={money(tot)} d={delta(tot, ptot)} />
            <Kpi t={L('Operaciones', 'Transactions')} v={String(cur.length)} d={delta(cur.length, prev.length)} />
            <Kpi t={L('Ticket promedio', 'Average ticket')} v={money(avg)} d={delta(avg, pavg)} />
            <Kpi t={L('Desde la app', 'From the app')} v={cur.length ? Math.round((cur.filter((o) => o.channel !== 'store').length / cur.length) * 100) + '%' : '—'} />
          </Row>

          <Card>
            <H2>{L('Meta del mes', 'Monthly goal')}</H2>
            <Row style={{ alignItems: 'flex-end' }}>
              <Field label={L('Meta de ventas (USD)', 'Sales goal (USD)')} value={goal} onChangeText={saveGoal} keyboardType="number-pad" placeholder="15000" style={{ maxWidth: 200 }} />
              <P small muted style={{ flex: 1, minWidth: 200 }}>{L('Se guarda en este equipo.', 'Saved on this device.')}</P>
            </Row>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: C.tint, overflow: 'hidden' }}>
              <View style={{ width: `${meta ? pct : 0}%`, height: '100%', backgroundColor: pct >= 100 ? C.gold : C.brown }} />
            </View>
            <P small>
              {L(`Llevas ${money(mesTot)}`, `So far ${money(mesTot)}`) + (meta ? L(` de ${money(meta)} (${pct}%).`, ` of ${money(meta)} (${pct}%).`) : '.') + ' ' + L(`A este ritmo cerrarías el mes en ${money(proj)}.`, `At this pace you'd close the month at ${money(proj)}.`)}
            </P>
          </Card>

          <Row style={{ alignItems: 'flex-start' }}>
            <Card style={{ flex: 1, minWidth: 280 }}>
              <H2>{L('Por tipo', 'By type')}</H2>
              {byKind.length ? byKind.map((x) => (
                <View key={x.k} style={{ gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '800', color: C.ink }}>{KIND[x.k][lang === 'es' ? 0 : 1] + ` · ${x.n}`}</Text>
                    <Text style={{ fontWeight: '900', color: C.ink }}>{money(x.t)}</Text>
                  </Row>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: C.tint }}>
                    <View style={{ width: `${(x.t / maxKind) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: C.brown }} />
                  </View>
                </View>
              )) : <P muted>{L('Sin ventas en este periodo.', 'No sales in this period.')}</P>}
            </Card>
            <Card style={{ flex: 1, minWidth: 280 }}>
              <H2>{L('Lo que más se vende', 'Best sellers')}</H2>
              {tops.length ? tops.map((x, i) => (
                <Row key={x.name} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <Text style={{ flex: 1, fontWeight: '800', color: C.ink }} numberOfLines={1}>{`${i + 1}. ${x.name}`}</Text>
                  <P small muted>{`${x.n}×`}</P>
                  <Text style={{ fontWeight: '900', color: C.ink, minWidth: 80, textAlign: 'right' }}>{money(x.t)}</Text>
                </Row>
              )) : <P muted>{L('Sin ventas en este periodo.', 'No sales in this period.')}</P>}
            </Card>
          </Row>

          {(() => {
            const day0 = new Date(); day0.setHours(0, 0, 0, 0);
            const A = Array.from({ length: 14 }, (_, i) => { const a = day0.getTime() - (13 - i) * DAY; return sum(d28.filter((o) => paid(o) >= a && paid(o) < a + DAY)); });
            const B = Array.from({ length: 14 }, (_, i) => { const a = day0.getTime() - (27 - i) * DAY; return sum(d28.filter((o) => paid(o) >= a && paid(o) < a + DAY)); });
            const mx = Math.max(1, ...A, ...B);
            const back = new Set(cur.map((o) => o.user_id)).size;
            const repeat = (() => { const by: Record<string, number> = {}; cur.forEach((o) => { if (o.user_id) by[o.user_id] = (by[o.user_id] || 0) + 1; }); const u = Object.values(by); return u.length ? Math.round((u.filter((n) => n > 1).length / u.length) * 100) : 0; })();
            return (
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H2>{L('Ventas por día · 14 días', 'Sales per day · 14 days')}</H2>
                  <P small muted>{L(`${back} clientes · ${repeat}% regresan`, `${back} customers · ${repeat}% return`)}</P>
                </Row>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 140 }}>
                  {A.map((v, i) => (
                    <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <View style={{ position: 'absolute', bottom: `${(B[i] / mx) * 100}%`, width: 7, height: 7, borderRadius: 4, backgroundColor: '#62BDF6', borderWidth: 1, borderColor: '#0B2E5E', zIndex: 2 }} />
                      <View accessibilityLabel={`${money(v)} vs ${money(B[i])}`} style={{ width: '70%', height: `${Math.max(1, (v / mx) * 100)}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: C.brown }} />
                    </View>
                  ))}
                </View>
                <P small muted>{L('■ estos 14 días · ● los 14 anteriores', '■ last 14 days · ● previous 14')}</P>
              </Card>
            );
          })()}

          <Card>
            <H2>{L('¿A qué hora llega más gente?', 'When are you busiest?')}</H2>
            <P small muted>{L('Más oscuro = más operaciones. Úsalo para decidir cuánta gente poner en cada turno.', 'Darker = more transactions. Use it to plan staff per shift.')}</P>
            <View style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', gap: 3, paddingLeft: 40 }}>
                {hours.map((h) => <Text key={h} style={{ flex: 1, fontSize: 10, color: C.muted, textAlign: 'center' }}>{h % 12 || 12}</Text>)}
              </View>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <View key={d} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                  <Text style={{ width: 37, fontSize: 11, fontWeight: '800', color: C.ink }}>{days[d]}</Text>
                  {hours.map((h) => {
                    const v = heat[d][h];
                    return <View key={h} accessibilityLabel={`${days[d]} ${h}:00 · ${v}`} style={{ flex: 1, height: 22, borderRadius: 4, backgroundColor: v ? C.brown : C.tint, opacity: v ? 0.25 + 0.75 * (v / maxHeat) : 1 }} />;
                  })}
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
