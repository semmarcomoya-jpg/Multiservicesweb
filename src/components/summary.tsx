import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { Card, H2, IcoBox, P, Pills, Row } from '@/components/ui';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Category, Order } from '@/lib/types';

export type Period = 'hoy' | '7' | '30' | 'todo';
const DAYS: Record<Period, number> = { hoy: 1, '7': 7, '30': 30, todo: 100000 };

export const inPeriod = (o: Order, p: Period) => Date.now() - new Date(o.created_at).getTime() < DAYS[p] * 86400000;
export const orderGroup = (o: Order) => (o.kind === 'service' ? 'cat:' + (o.service_name?.cat || 'otros') : o.kind);
export const orderSvcKey = (o: Order) => o.service_id || o.kind;

const agg = (arr: Order[]) => ({
  n: arr.length,
  total: arr.reduce((a, o) => a + Number(o.total || 0), 0),
  fee: arr.reduce((a, o) => a + Number(o.fee || 0), 0),
});

export function useGroups(cats: Category[]) {
  const { L, nm } = useLang();
  return [
    ['send', L('Envíos a México', 'Money to Mexico'), 'send'] as const,
    ...cats.map((c) => ['cat:' + c.id, nm(c), c.icon] as const),
    ['shop', L('Productos', 'Products'), 'bag'] as const,
  ];
}

/** Tarjetas con número de pedidos y total por tipo; tocar una filtra la lista. */
export function Summary({
  orders,
  cats,
  period,
  setPeriod,
  kind,
  setKind,
  svc,
  setSvc,
}: {
  orders: Order[];
  cats: Category[];
  period: Period;
  setPeriod: (p: Period) => void;
  kind: string;
  setKind: (k: string) => void;
  svc: string;
  setSvc: (k: string) => void;
}) {
  const { L, nm } = useLang();
  const groups = useGroups(cats);
  const per = orders.filter((o) => inPeriod(o, period) && o.status !== 'rechazado');
  const all = agg(per);
  const tiles = groups.map(([k, label, icon]) => ({ k, label, icon, ...agg(per.filter((o) => orderGroup(o) === k)) })).filter((g) => g.n > 0 || g.k === kind);
  const subs: { k: string; label: string; n: number; total: number }[] = [];
  if (kind.startsWith('cat:')) {
    const m = new Map<string, Order[]>();
    per.filter((o) => orderGroup(o) === kind).forEach((o) => m.set(orderSvcKey(o), [...(m.get(orderSvcKey(o)) || []), o]));
    m.forEach((arr, k) => subs.push({ k, label: nm(arr[0].service_name), ...agg(arr) }));
    subs.sort((a, b) => b.total - a.total);
  }
  const sel = kind === 'all' ? all : tiles.find((t) => t.k === kind) || all;
  const nPed = (n: number) => `${n} ${n === 1 ? L('pedido', 'order') : L('pedidos', 'orders')}`;

  const Tile = ({ k, label, icon, n, total }: { k: string; label: string; icon: string; n: number; total: number }) => {
    const on = kind === k;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => {
          setKind(k);
          setSvc('all');
        }}
        style={{ flexGrow: 1, flexBasis: 150, maxWidth: 280, gap: 6, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: on ? C.gold : C.line, backgroundColor: on ? C.tint : C.card }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IcoBox n={icon} size={30} />
          <Text style={{ flex: 1, minWidth: 0, fontWeight: '800', fontSize: 13, color: C.ink }} numberOfLines={2}>{label}</Text>
        </View>
        {/* El monto usa todo el ancho de la tarjeta para que nunca se corte */}
        <Text style={{ fontWeight: '900', fontSize: money(total).length > 10 ? 16 : 19, color: C.ink }}>{money(total)}</Text>
        <P small muted>{nPed(n)}</P>
      </Pressable>
    );
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{L('Resumen de pedidos', 'Orders summary')}</H2>
        <Pills
          options={[
            { v: 'hoy' as Period, label: L('Hoy', 'Today') },
            { v: '7' as Period, label: L('7 días', '7 days') },
            { v: '30' as Period, label: L('30 días', '30 days') },
            { v: 'todo' as Period, label: L('Todo', 'All') },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile k="all" label={L('Todos', 'All')} icon="chart" n={all.n} total={all.total} />
        {tiles.map((t) => (
          <Tile key={t.k} {...t} />
        ))}
      </Row>
      {subs.length ? (
        <Pills
          options={[{ v: 'all', label: L('Todos los servicios', 'All services') }, ...subs.map((x) => ({ v: x.k, label: `${x.label} · ${x.n} · ${money(x.total)}` }))]}
          value={svc}
          onChange={setSvc}
        />
      ) : null}
      <Desglose orders={kind === 'all' ? per : per.filter((o) => orderGroup(o) === kind)} />
      <Row gap={18} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
        <P>{L('Total cobrado: ', 'Total charged: ')}<Text style={{ fontWeight: '900' }}>{money(sel.total)}</Text></P>
        <P>{L('Comisiones: ', 'Fees: ')}<Text style={{ fontWeight: '900' }}>{money(sel.fee)}</Text></P>
        <P>{L('Ticket promedio: ', 'Average ticket: ')}<Text style={{ fontWeight: '900' }}>{money(sel.n ? sel.total / sel.n : 0)}</Text></P>
        <P small muted>{L('No incluye rechazados', 'Excludes rejected')}</P>
      </Row>
    </Card>
  );
}

/** Desglose por servicio o por producto: cuántos y cuánto, de mayor a menor. */
function Desglose({ orders }: { orders: Order[] }) {
  const { L, nm } = useLang();
  const [tab, setTab] = useState<'svc' | 'prod'>('svc');
  const [all, setAll] = useState(false);
  const svc = new Map<string, { label: string; icon: string; n: number; total: number }>();
  const prod = new Map<string, { label: string; n: number; total: number }>();
  orders.forEach((o) => {
    if (o.kind === 'shop') {
      (o.items || []).forEach((x) => {
        const k = x.name + ' · ' + x.label;
        const e = prod.get(k) || { label: k, n: 0, total: 0 };
        e.n += Number(x.qty) || 1;
        e.total += (Number(x.qty) || 1) * Number(x.price || 0);
        prod.set(k, e);
      });
    } else {
      const k = o.kind === 'send' ? 'send' : o.service_id || 'otro';
      const label = o.kind === 'send' ? L('Envíos a México', 'Money to Mexico') : nm(o.service_name);
      const e = svc.get(k) || { label, icon: o.kind === 'send' ? 'send' : o.service_name?.icon || 'tool', n: 0, total: 0 };
      e.n += 1;
      e.total += Number(o.total || 0);
      svc.set(k, e);
    }
  });
  const rows = [...(tab === 'svc' ? svc : prod).values()].sort((a, b) => b.total - a.total);
  if (!svc.size && !prod.size) return null;
  const max = rows[0]?.total || 1;
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '900', color: C.ink, fontSize: 15 }}>{L('Por servicio o producto', 'By service or product')}</Text>
        <Pills
          options={[
            { v: 'svc' as const, label: L(`Servicios · ${svc.size}`, `Services · ${svc.size}`), icon: 'tool' },
            { v: 'prod' as const, label: L(`Productos · ${prod.size}`, `Products · ${prod.size}`), icon: 'bag' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Row>
      {rows.length === 0 ? <P small muted>{tab === 'svc' ? L('Sin servicios en este periodo.', 'No services in this period.') : L('Sin productos vendidos en este periodo.', 'No products sold in this period.')}</P> : null}
      {(all ? rows : rows.slice(0, 8)).map((r) => (
        <View key={r.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {'icon' in r ? <IcoBox n={(r as { icon: string }).icon} size={28} /> : <IcoBox n="bag" size={28} />}
            <Text style={{ flex: 1, minWidth: 0, color: C.ink, fontWeight: '700' }} numberOfLines={2}>{r.label}</Text>
            <Text style={{ color: C.muted, fontWeight: '700' }}>{tab === 'svc' ? L(`${r.n} ped.`, `${r.n} ord.`) : L(`${r.n} pzas`, `${r.n} pcs`)}</Text>
            <Text style={{ color: C.ink, fontWeight: '900', minWidth: 90, textAlign: 'right' }}>{money(r.total)}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.tint, marginLeft: 38 }}>
            <View style={{ width: `${Math.max(3, (r.total / max) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: tab === 'svc' ? C.blue : C.gold }} />
          </View>
        </View>
      ))}
      {rows.length > 8 ? (
        <Pressable onPress={() => setAll(!all)}>
          <Text style={{ color: C.blue, fontWeight: '800' }}>{all ? L('Ver menos', 'Show less') : L(`Ver los ${rows.length}`, `Show all ${rows.length}`)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
