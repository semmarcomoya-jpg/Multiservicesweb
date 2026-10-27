import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useOrderText } from '@/components/orders';
import { Text } from '@/components/Text';
import { BackBar, Card, Empty, H1, Icon, Loading, Note, P, Pills, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { money, mxn } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';
import { useMyPoints } from '@/lib/points';
import { C, R } from '@/lib/theme';

type Per = 'mes' | 'tres' | 'anio';
const DAYS: Record<Per, number> = { mes: 30, tres: 90, anio: 365 };

export default function MisCuentas() {
  const { L, nm, lang } = useLang();
  const { session } = useAuth();
  const { orders } = useMyOrders(1000);
  const { rows } = useMyPoints(session?.user.id);
  const { title } = useOrderText();
  const [per, setPer] = useState<Per>('mes');
  const [show, setShow] = useState(false); // cantidades ocultas al entrar (privacidad)
  if (!orders) return <Loading />;
  const since = Date.now() - DAYS[per] * 864e5;
  const done = orders.filter((o) => o.status === 'completado' && new Date(o.created_at).getTime() >= since);
  const M = (n: number) => (show ? money(n) : '$ ••••');
  const sends = done.filter((o) => o.kind === 'send');
  const sentUsd = sends.reduce((a, o) => a + Number(o.monto), 0);
  const sentMxn = sends.reduce((a, o) => a + Number(o.mxn || 0), 0);
  const byP = new Map<string, { name: string; rel: string; usd: number; n: number }>();
  sends.forEach((o) => {
    const b = o.beneficiary;
    const k = b ? `${b.nombre} ${b.apellidos}` : '—';
    const e = byP.get(k) || { name: k, rel: b?.parentesco || '', usd: 0, n: 0 };
    e.usd += Number(o.monto);
    e.n += 1;
    byP.set(k, e);
  });
  const people = [...byP.values()].sort((a, b) => b.usd - a.usd);
  const byCat = new Map<string, number>();
  done.filter((o) => o.kind !== 'send').forEach((o) => {
    const k = o.kind === 'shop' ? L('Compras en tienda', 'Shop purchases') : o.kind === 'abono' ? L('Abonos de crédito', 'Credit payments') : nm(o.service_name);
    byCat.set(k, (byCat.get(k) || 0) + Number(o.total));
  });
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const saved = done.reduce((a, o) => a + Number(o.discount || 0), 0);
  const ptsWon = (rows || []).filter((r) => r.pts > 0 && new Date(r.created_at).getTime() >= since).reduce((a, r) => a + r.pts, 0);
  const nT = (n: number) => L(`${n} envío${n === 1 ? '' : 's'}`, `${n} transfer${n === 1 ? '' : 's'}`);

  const Bar = ({ label, sub, val, max, gold }: { label: string; sub?: string; val: number; max: number; gold?: boolean }) => (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>
          <Text style={{ fontWeight: '900' }}>{label}</Text>
          {sub ? <Text style={{ color: C.muted }}> · {sub}</Text> : null}
        </Text>
        <Text style={{ fontWeight: '900', color: C.ink }}>{M(val)}</Text>
      </View>
      {show ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.tint, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(4, Math.round((val / (max || 1)) * 100))}%`, height: '100%', backgroundColor: gold ? C.gold : C.blue }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen wall="profile">
      <BackBar title={L('Mis cuentas', 'My accounts')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <H1>{L('Mis cuentas', 'My accounts')}</H1>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: show }} onPress={() => setShow(!show)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
          <Icon n={show ? 'lock' : 'eye'} size={16} color={C.ink} />
          <Text style={{ fontWeight: '800', color: C.ink }}>{show ? L('Ocultar cantidades', 'Hide amounts') : L('Mostrar cantidades', 'Show amounts')}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon n="lock" size={16} color={C.muted} />
        <P small muted style={{ flex: 1 }}>{L('Solo tú ves esto. Nadie de la tienda tiene acceso a este resumen.', 'Only you see this. No one at the store can see this summary.')}</P>
      </View>
      <Pills options={[{ v: 'mes' as Per, label: L('Este mes', 'This month') }, { v: 'tres' as Per, label: L('3 meses', '3 months') }, { v: 'anio' as Per, label: L('Este año', 'This year') }]} value={per} onChange={setPer} />
      {!show ? <Note kind="blue" icon="eye">{L('Tus cantidades están ocultas. Toca "Mostrar cantidades" para verlas.', 'Your amounts are hidden. Tap "Show amounts" to see them.')}</Note> : null}
      {done.length === 0 ? (
        <Empty>{L('No hay movimientos completados en este periodo.', 'No completed activity in this period.')}</Empty>
      ) : (
        <>
          <View style={{ backgroundColor: C.brownDark, borderRadius: 22, padding: 20, gap: 4 }}>
            <Text style={{ color: '#DCE7F6', fontWeight: '800' }}>{L('Enviaste a tu familia', 'You sent your family')}</Text>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900' }}>{M(sentUsd)}</Text>
            <Text style={{ color: '#DCE7F6' }}>{(show ? L(`Recibieron ${mxn(sentMxn)} · `, `They got ${mxn(sentMxn)} · `) : '') + nT(sends.length)}</Text>
          </View>
          {people.length ? (
            <Card>
              <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L('Por persona', 'By person')}</Text>
              {people.map((p) => <Bar key={p.name} label={p.name} sub={[p.rel, nT(p.n)].filter(Boolean).join(' · ')} val={p.usd} max={people[0].usd} />)}
            </Card>
          ) : null}
          {cats.length ? (
            <Card>
              <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L('Servicios y compras', 'Bills and shopping')}</Text>
              {cats.map(([k, v]) => <Bar key={k} label={k} val={v} max={cats[0][1]} gold />)}
            </Card>
          ) : null}
          <Card>
            <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L('Lo que ahorraste', 'Your savings')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <P>{L('Descuentos con tus puntos', 'Discounts with your points')}</P>
              <P style={{ fontWeight: '900' }}>{M(saved)}</P>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <P>{L('Puntos que ganaste', 'Points earned')}</P>
              <P style={{ fontWeight: '900' }}>+{ptsWon} pts</P>
            </View>
          </Card>
          <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L('Historial', 'History')}</Text>
          {done.map((o) => (
            <Pressable key={o.id} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={1}>{title(o)}</Text>
                <P small muted>{o.folio} · {new Date(o.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}</P>
              </View>
              <Text style={{ fontWeight: '900', color: C.ink }}>{M(Number(o.total))}</Text>
            </Pressable>
          ))}
          <P small muted>{L('Solo cuentan pedidos completados.', 'Only completed orders count.')}</P>
        </>
      )}
    </Screen>
  );
}
