/** Tarjeta de un crédito o apartado (cliente y tienda). */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { P } from '@/components/ui';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { nextPay, pays, planState, today } from '@/lib/plans';
import { C, R } from '@/lib/theme';
import type { Plan } from '@/lib/types';

export function usePlanText() {
  const { L } = useLang();
  return {
    freqName: (f: string) => ({ semanal: L('Semanal', 'Weekly'), quincenal: L('Quincenal', 'Every 2 weeks'), mensual: L('Mensual', 'Monthly') })[f] || f,
    freqPl: (f: string) => ({ semanal: L('semanales', 'weekly'), quincenal: L('quincenales', 'biweekly'), mensual: L('mensuales', 'monthly') })[f] || f,
    stateLbl: (s: string, staff = false) =>
      ({
        solicitado: staff ? L('Por aprobar', 'To approve') : L('En revisión', 'Under review'),
        corriente: L('Al corriente', 'Up to date'),
        atrasado: L('Atrasado', 'Late'),
        liquidado: L('Liquidado', 'Paid off'),
        rechazado: staff ? L('Rechazado', 'Rejected') : L('No aprobado', 'Not approved'),
        cancelado: L('Cancelado', 'Cancelled'),
      })[s] || s,
  };
}
export const STATE_COLORS: Record<string, { bg: string; fg: string }> = {
  solicitado: { bg: '#FDE7C8', fg: '#7A4A00' },
  corriente: { bg: '#DDF1E4', fg: '#1E5B35' },
  atrasado: { bg: '#F7DCD6', fg: '#8E2A1B' },
  liquidado: { bg: '#DDEEFC', fg: '#0D4A82' },
  rechazado: { bg: '#E1E9F3', fg: '#55688A' },
  cancelado: { bg: '#E1E9F3', fg: '#55688A' },
};

export function PlanCard({ p, staff, storeName, actions, children }: { p: Plan; staff?: boolean; storeName?: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const { L, lang } = useLang();
  const { freqPl, stateLbl } = usePlanText();
  const [open, setOpen] = useState(false);
  const st = planState(p);
  const list = pays(p);
  const paid = list.filter((x) => x.paid_at);
  const nx = nextPay(p);
  const col = STATE_COLORS[st] || STATE_COLORS.cancelado;
  const fmt = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
  return (
    <View style={{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: st === 'atrasado' ? '#F3C6BE' : C.line, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <P small muted style={{ fontWeight: '800' }}>
            {(p.kind === 'credito' ? L('Crédito', 'Credit') : L('Apartado', 'Layaway')) + ' · ' + p.folio}
            {storeName ? ' · ' + storeName : ''}
          </P>
          <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }} numberOfLines={2}>{staff ? `${p.cliente_nombre} · ${p.item_name}` : p.item_name}</Text>
          <P small muted>{p.item_label} · {money(p.price)} · {L('enganche ', 'down ') + money(p.down)}</P>
        </View>
        <View style={{ backgroundColor: col.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: col.fg }}>{stateLbl(st, staff)}</Text>
        </View>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.tint, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round((paid.length / p.n) * 100)}%`, height: '100%', backgroundColor: C.gold }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <P small>{L(`${paid.length} de ${p.n} pagos ${freqPl(p.freq)}`, `${paid.length} of ${p.n} ${freqPl(p.freq)} payments`)}</P>
        <P small style={{ fontWeight: '800' }}>{money(paid.reduce((a, x) => a + Number(x.amount), 0))} / {money(p.total_fin)}</P>
      </View>
      {nx && (st === 'corriente' || st === 'atrasado') ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: R.md, backgroundColor: st === 'atrasado' ? '#F7DCD6' : C.blueSoft }}>
          <View>
            <Text style={{ fontWeight: '900', color: st === 'atrasado' ? C.red : C.blueInk }}>{(st === 'atrasado' ? L('Abono vencido', 'Overdue payment') : L('Próximo abono', 'Next payment')) + ` · ${nx.i}/${p.n}`}</Text>
            <P small>{fmt(nx.due)}</P>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{money(nx.amount)}</Text>
        </View>
      ) : null}
      {p.status === 'rechazado' && p.reject_reason ? <P small style={{ color: C.red }}>{p.reject_reason}</P> : null}
      {children}
      {actions}
      <Pressable onPress={() => setOpen(!open)}>
        <Text style={{ color: C.blue, fontWeight: '800' }}>{open ? L('Ocultar calendario', 'Hide schedule') : L('Ver calendario de pagos', 'See payment schedule')}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <P small>{p.kind === 'credito' ? L('Enganche', 'Down payment') : L('Primer abono', 'First payment')}</P>
            <P small style={{ fontWeight: '800' }}>{money(p.down)}</P>
          </View>
          {list.map((x) => (
            <View key={x.i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.line }}>
              <P small>{x.i}. {fmt(x.due)}</P>
              <P small style={{ fontWeight: '800', color: x.paid_at ? '#1E5B35' : x.due.slice(0, 10) < today() ? C.red : C.ink }}>
                {money(x.amount)} · {x.paid_at ? L('Pagado', 'Paid') + (x.by_name ? ' · ' + x.by_name : '') : x.due.slice(0, 10) < today() ? L('Vencido', 'Late') : L('Pendiente', 'Pending')}
              </P>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
