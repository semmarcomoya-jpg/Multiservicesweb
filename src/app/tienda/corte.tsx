import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@/components/Text';

import { useOrderText } from '@/components/orders';
import { PanelHeader, usePanelStore } from '@/components/panel';
import { orderGroup, useGroups } from '@/components/summary';
import { Btn, Card, Empty, Field, H2, IcoBox, Label, Loading, Note, P, Row, Screen, SearchBox, matches } from '@/components/ui';
import { useCategories, useStores } from '@/lib/data';
import { digits, money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import { useEmp } from '@/lib/emp';
import type { Corte, Gasto, Order } from '@/lib/types';

type PM = 'zelle' | 'cash' | 'card';
const PMS: PM[] = ['zelle', 'cash', 'card'];
const pmOf = (o: Order): PM => (o.pay_method === 'cash' || o.pay_method === 'card' ? o.pay_method : 'zelle');
/** Celda segura para Excel: lo que empieza con = + - @ se guarda como texto */
export const csvCell = (c: unknown) => {
  let s = String(c ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function TiendaCorte() {
  const { L, lang } = useLang();
  const { title } = useOrderText();
  const { data: stores, reload: reloadStores } = useStores();
  const { data: cats } = useCategories();
  const groups = useGroups(cats || []);
  const st = usePanelStore(stores);
  const [sel, setSel] = useState<string>('actual'); // 'actual' = desde el último corte
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [pin, setPin] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const emp = useEmp(st?.id);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [counted, setCounted] = useState<Record<PM, string>>({ zelle: '', cash: '', card: '' });
  const [review, setReview] = useState(false);
  const [g, setG] = useState({ concepto: '', monto: '', metodo: 'cash' as PM });
  const pmName = (k: PM) => ({ zelle: 'Zelle', cash: L('Efectivo', 'Cash'), card: L('Tarjeta', 'Card') })[k];

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const load = useCallback(async () => {
    if (!st) return;
    setOrders(null);
    const { data: cs } = await supabase.from('cortes').select('*').eq('store_id', st.id).order('hasta', { ascending: false }).limit(60);
    setCortes((cs as Corte[]) ?? []);
    let q = supabase.from('orders').select('*').eq('store_id', st.id).not('paid_at', 'is', null).neq('status', 'rechazado').order('paid_at');
    q = sel === 'actual' ? q.is('corte_id', null) : q.eq('corte_id', sel);
    const { data } = await q;
    setOrders((data as Order[]) ?? []);
    let gq = supabase.from('caja_gastos').select('*').eq('store_id', st.id).order('created_at');
    gq = sel === 'actual' ? gq.is('corte_id', null) : gq.eq('corte_id', sel);
    const { data: gs } = await gq;
    setGastos((gs as Gasto[]) ?? []);
  }, [st, sel]);

  useEffect(() => {
    load();
  }, [load]);

  if (!stores || !cats) return <Loading />;
  const corte = cortes.find((c) => c.id === sel) || null;
  const last = cortes[0];
  const desde = sel === 'actual' ? last?.hasta ?? null : corte?.desde ?? null;
  const hasta = sel === 'actual' ? new Date().toISOString() : corte?.hasta;

  const list = orders || [];
  const total = list.reduce((a, o) => a + Number(o.total), 0);
  const fees = list.reduce((a, o) => a + Number(o.fee), 0);
  const byPm = Object.fromEntries(PMS.map((k) => [k, list.filter((o) => pmOf(o) === k).reduce((a, o) => a + Number(o.total), 0)])) as Record<PM, number>;
  const gastoPm = Object.fromEntries(PMS.map((k) => [k, gastos.filter((x) => x.metodo === k).reduce((a, x) => a + Number(x.monto), 0)])) as Record<PM, number>;
  const expected = Object.fromEntries(PMS.map((k) => [k, Math.round((byPm[k] - gastoPm[k]) * 100) / 100])) as Record<PM, number>;
  const countedNum = (k: PM) => (sel === 'actual' ? parseFloat(counted[k]) : Number(corte?.contado?.[k]));
  const hasCount = (k: PM) => (sel === 'actual' ? counted[k] !== '' : corte?.contado?.[k] != null);
  const missingCount = PMS.some((k) => byPm[k] - gastoPm[k] !== 0 && counted[k] === '');
  const byType = groups
    .map(([k, label, icon]) => {
      const arr = list.filter((o) => orderGroup(o) === k);
      return { k, label, icon, n: arr.length, total: arr.reduce((a, o) => a + Number(o.total), 0), fee: arr.reduce((a, o) => a + Number(o.fee), 0) };
    })
    .filter((x) => x.n > 0);
  const empMap = new Map<string, { n: number; total: number }>();
  list.forEach((o) => {
    const k = o.attended_name || L('Sin asignar', 'Unassigned');
    const e = empMap.get(k) || { n: 0, total: 0 };
    empMap.set(k, { n: e.n + 1, total: e.total + Number(o.total) });
  });
  // Productos vendidos (para cuadrar inventario)
  const prodMap = new Map<string, { qty: number; total: number }>();
  list.filter((o) => o.kind === 'shop').forEach((o) =>
    (o.items || []).forEach((it) => {
      const k = `${it.name} · ${it.label}`;
      const e = prodMap.get(k) || { qty: 0, total: 0 };
      prodMap.set(k, { qty: e.qty + it.qty, total: e.total + it.qty * Number(it.price) });
    }),
  );

  const csv = () => {
    const head = ['Folio', 'Pagado', 'Cliente', 'Número de cliente', 'Concepto', 'Tipo', 'Atendió', 'Forma de pago', 'Monto', 'Comisión', 'Total', 'Estado'];
    const rows = list.map((o) => [o.folio, fmt(o.paid_at), o.cliente_nombre, o.cliente_code, title(o), groups.find((g) => g[0] === orderGroup(o))?.[1] || o.kind, o.attended_name || '', pmName(pmOf(o)), Number(o.monto).toFixed(2), Number(o.fee).toFixed(2), Number(o.total).toFixed(2), o.status]);
    rows.push(['', '', '', '', '', '', '', 'TOTAL', (total - fees).toFixed(2), fees.toFixed(2), total.toFixed(2), '']);
    gastos.forEach((x) => rows.push(['', fmt(x.created_at), '', '', L('Gasto de caja: ', 'Cash expense: ') + x.concepto, '', x.employee_name, pmName(x.metodo), (-Number(x.monto)).toFixed(2), '', '', '']));
    return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  };
  const fileName = `corte-${(st?.nombre || 'tienda').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date(hasta || Date.now()).toISOString().slice(0, 10)}.csv`;

  const download = async () => {
    const text = csv();
    if (Platform.OS === 'web') {
      const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      await Share.share({ title: fileName, message: text });
    }
  };

  const makeCorte = async () => {
    if (!st) return;
    setErr('');
    setMsg('');
    setBusy(true);
    const contado = Object.fromEntries(PMS.map((k) => [k, parseFloat(counted[k]) || 0]));
    const { data, error } = await supabase.rpc('make_corte', { p_store: st.id, p_pin: pin || emp?.pin || '', p_notas: notas.trim(), p_contado: contado }).single<Corte>();
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setPin('');
    setNotas('');
    setCounted({ zelle: '', cash: '', card: '' });
    setReview(false);
    setMsg(L(`Corte hecho por ${data.employee_name}: ${data.n_orders} ventas, ${money(data.total)}.`, `Close-out by ${data.employee_name}: ${data.n_orders} sales, ${money(data.total)}.`));
    setSel(data.id);
  };

  const cell = { paddingVertical: 8, paddingHorizontal: 8 } as const;

  return (
    <Screen wide>

      <Card>
        <H2>{L('Informe de ventas para el corte', 'Sales report for close-out')}</H2>
        <P small muted>{L('Cuenta lo cobrado en la app (Zelle ya confirmado) y en mostrador (efectivo, tarjeta o Zelle). Los rechazados no cuentan.', 'Counts app sales (confirmed Zelle) and counter sales (cash, card or Zelle). Rejected orders are excluded.')}</P>
        <Row gap={8}>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: sel === 'actual' }} onPress={() => setSel('actual')}
            style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1.5, borderColor: sel === 'actual' ? C.brown : C.line2, backgroundColor: sel === 'actual' ? C.tint : C.card }}>
            <Text style={{ fontWeight: '900', color: C.ink }}>{L('Desde el último corte', 'Since last close-out')}</Text>
          </Pressable>
          {cortes.slice(0, 8).map((c) => (
            <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ checked: sel === c.id }} onPress={() => setSel(c.id)}
              style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1.5, borderColor: sel === c.id ? C.brown : C.line2, backgroundColor: sel === c.id ? C.tint : C.card }}>
              <Text style={{ fontWeight: '800', color: C.softInk }}>{L('Corte ', 'Close-out ') + fmt(c.hasta)}</Text>
            </Pressable>
          ))}
        </Row>
      </Card>

      {!orders ? (
        <Loading />
      ) : (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{st?.nombre}</Text>
                <P small muted>{L('Del ', 'From ') + (desde ? fmt(desde) : L('inicio', 'the start')) + L(' al ', ' to ') + fmt(hasta)}</P>
                {corte ? <P small muted>{L('Corte hecho por ', 'Close-out by ') + corte.employee_name}{corte.notas ? ' · ' + corte.notas : ''}</P> : null}
              </View>
              <Row gap={8}>
                <Btn small kind="ghost" icon="doc" title={L('Descargar Excel (CSV)', 'Download Excel (CSV)')} onPress={download} disabled={!list.length} />
                {Platform.OS === 'web' ? <Btn small kind="ghost" icon="receipt" title={L('Imprimir', 'Print')} onPress={() => window.print()} /> : null}
              </Row>
            </Row>
            <Row gap={10} style={{ alignItems: 'stretch' }}>
              {[
                [L('Ventas', 'Sales'), String(list.length)],
                [L('Total cobrado', 'Total collected'), money(total)],
                ['Zelle', money(byPm.zelle)],
                [L('Efectivo', 'Cash'), money(byPm.cash)],
                [L('Tarjeta', 'Card'), money(byPm.card)],
                [L('Comisiones y cargos', 'Fees'), money(fees)],
              ].map(([k, v]) => (
                <View key={k} style={{ flexGrow: 1, minWidth: 180, padding: 12, borderRadius: R.md, backgroundColor: C.cream }}>
                  <P small muted>{k}</P>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{v}</Text>
                </View>
              ))}
            </Row>
          </Card>

          {list.length === 0 ? (
            <Empty>{sel === 'actual' ? L('No hay ventas nuevas desde el último corte.', 'No new sales since the last close-out.') : L('Este corte no tuvo ventas.', 'This close-out had no sales.')}</Empty>
          ) : (
            <>
              <Row gap={16} style={{ alignItems: 'flex-start' }}>
                <Card style={{ flexGrow: 1, minWidth: 300 }}>
                  <Label>{L('Por tipo', 'By type')}</Label>
                  {byType.map((x) => (
                    <Row key={x.k} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <Row gap={8} style={{ flexWrap: 'nowrap', flex: 1 }}>
                        <IcoBox n={x.icon} size={28} />
                        <P style={{ flex: 1 }}>{x.label} · {x.n}</P>
                      </Row>
                      <Text style={{ fontWeight: '900', color: C.ink }}>{money(x.total)}</Text>
                    </Row>
                  ))}
                </Card>
                <Card style={{ flexGrow: 1, minWidth: 260 }}>
                  <Label>{L('Por empleado', 'By employee')}</Label>
                  {[...empMap.entries()].map(([k, v]) => (
                    <Row key={k} style={{ justifyContent: 'space-between' }}>
                      <P>{k} · {v.n}</P>
                      <Text style={{ fontWeight: '900', color: C.ink }}>{money(v.total)}</Text>
                    </Row>
                  ))}
                </Card>
                {prodMap.size ? (
                  <Card style={{ flexGrow: 1, minWidth: 260 }}>
                    <Label>{L('Productos vendidos', 'Products sold')}</Label>
                    {[...prodMap.entries()].map(([k, v]) => (
                      <Row key={k} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                        <P style={{ flex: 1 }}>{v.qty} × {k}</P>
                        <Text style={{ fontWeight: '900', color: C.ink }}>{money(v.total)}</Text>
                      </Row>
                    ))}
                  </Card>
                ) : null}
              </Row>

              <Card>
                <Label>{L('Detalle de ventas', 'Sales detail')}</Label>
                {list.length > 5 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca folio, cliente o empleado', 'Search ref, customer or employee')} /> : null}
                <ScrollView horizontal>
                  <View>
                    <Row gap={0} style={{ flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: C.line }}>
                      {[[L('Folio', 'Ref'), 80], [L('Pagado', 'Paid'), 150], [L('Cliente', 'Customer'), 170], [L('Concepto', 'Item'), 240], [L('Atendió', 'By'), 100], [L('Comisión', 'Fee'), 110], [L('Total', 'Total'), 130]].map(([h, w]) => (
                        <Text key={h as string} style={[cell, { width: w as number, fontWeight: '800', color: C.muted, textAlign: (h === L('Comisión', 'Fee') || h === L('Total', 'Total')) ? 'right' : 'left' }]}>{h}</Text>
                      ))}
                    </Row>
                    {list.filter((o) => matches(q, o.folio, o.cliente_nombre, o.attended_name, title(o))).map((o) => (
                      <Row key={o.id} gap={0} style={{ flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: C.line }}>
                        <Text style={[cell, { width: 80, fontWeight: '800', color: C.ink }]}>{o.folio}</Text>
                        <Text style={[cell, { width: 150, color: C.ink }]}>{fmt(o.paid_at)}</Text>
                        <Text style={[cell, { width: 170, color: C.ink }]} numberOfLines={1}>{o.cliente_nombre}</Text>
                        <Text style={[cell, { width: 240, color: C.ink }]} numberOfLines={1}>{title(o)}</Text>
                        <Text style={[cell, { width: 100, color: C.ink }]}>{o.attended_name || '—'}</Text>
                        <Text style={[cell, { width: 110, color: C.ink, textAlign: 'right' }]}>{money(o.fee)}</Text>
                        <Text style={[cell, { width: 130, color: C.ink, fontWeight: '900', textAlign: 'right' }]}>{money(o.total)}</Text>
                      </Row>
                    ))}
                    <Row gap={0} style={{ flexWrap: 'nowrap', backgroundColor: C.tint }}>
                      <Text style={[cell, { width: 740, fontWeight: '900', color: C.ink }]}>{L('Total', 'Total')}</Text>
                      <Text style={[cell, { width: 110, fontWeight: '900', color: C.ink, textAlign: 'right' }]}>{money(fees)}</Text>
                      <Text style={[cell, { width: 130, fontWeight: '900', color: C.ink, textAlign: 'right' }]}>{money(total)}</Text>
                    </Row>
                  </View>
                </ScrollView>
              </Card>
            </>
          )}

          <Card>
            <H2>{L('Gastos de caja', 'Cash expenses')}</H2>
            <P small muted>{L('Lo que sale de la caja (papel, agua, cambio a otra sucursal). Se resta de lo que debe haber.', 'Money taken from the register (paper, water…). It is subtracted from what should be there.')}</P>
            {gastos.map((x) => (
              <Row key={x.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 }}>
                <P style={{ flex: 1 }}>{x.concepto} · {pmName(x.metodo)} · {x.employee_name}</P>
                <Text style={{ fontWeight: '900', color: C.ink }}>−{money(x.monto)}</Text>
              </Row>
            ))}
            {!gastos.length ? <P small muted>{L('Sin gastos.', 'No expenses.')}</P> : null}
            {sel === 'actual' ? (
              <Row style={{ alignItems: 'flex-end' }}>
                <Field label={L('Concepto', 'Concept')} value={g.concepto} onChangeText={(v) => setG({ ...g, concepto: v })} placeholder={L('Ej. Garrafón de agua', 'E.g. Water jug')} />
                <Field label={L('Monto (USD)', 'Amount (USD)')} value={g.monto} onChangeText={(v) => setG({ ...g, monto: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={{ maxWidth: 140 }} />
                {!emp ? <Field label={L('Clave de empleado', 'Employee code')} value={pin} onChangeText={(v) => setPin(digits(v))} secure keyboardType="number-pad" maxLength={6} style={{ maxWidth: 160 }} /> : null}
                <Btn
                  title={L('Agregar gasto', 'Add expense')}
                  disabled={!g.concepto.trim() || !(parseFloat(g.monto) > 0) || (!emp && pin.length < 4)}
                  onPress={async () => {
                    setErr('');
                    const { error } = await supabase.rpc('add_gasto', { p_store: st!.id, p_pin: emp?.pin || pin, p_concepto: g.concepto.trim(), p_monto: parseFloat(g.monto), p_metodo: g.metodo, p_foto: null });
                    if (error) return setErr(errMsg(error));
                    setG({ concepto: '', monto: '', metodo: 'cash' });
                    load();
                  }}
                />
              </Row>
            ) : null}
          </Card>

          {list.length || gastos.length ? (
            <Card>
              <H2>{sel === 'actual' ? L('Cuenta la caja', 'Count the register') : L('Lo que se contó', 'What was counted')}</H2>
              {sel === 'actual' ? <P small muted>{L('Escribe cuánto hay de verdad en cada forma de pago. Te decimos si falta o sobra antes de cerrar.', 'Enter what is really there for each payment method. We show any shortage or surplus before closing.')}</P> : null}
              {PMS.map((k) => {
                const exp = sel === 'actual' ? expected[k] : Number(corte?.resumen?.por_pago?.[k]?.total || 0) - Number(corte?.resumen?.gastos_por_pago?.[k] || 0);
                const diff = hasCount(k) ? Math.round((countedNum(k) - exp) * 100) / 100 : null;
                return (
                  <Row key={k} style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 }}>
                    <Text style={{ fontWeight: '900', color: C.ink, width: 90 }}>{pmName(k)}</Text>
                    <P style={{ width: 170 }}>{L('Debe haber ', 'Should be ') + money(exp)}</P>
                    {sel === 'actual' && !review ? (
                      <Field label="" placeholder={L('Contaste', 'Counted')} value={counted[k]} onChangeText={(v) => setCounted({ ...counted, [k]: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={{ maxWidth: 150 }} />
                    ) : (
                      <P style={{ width: 150 }}>{hasCount(k) ? L('Contaste ', 'Counted ') + money(countedNum(k)) : '—'}</P>
                    )}
                    {diff !== null ? (
                      <Text style={{ fontWeight: '900', color: diff === 0 ? '#1E5B35' : diff < 0 ? C.red : C.blueInk }}>
                        {diff === 0 ? L('Cuadra', 'Balanced') : (diff < 0 ? L('Faltan ', 'Short ') : L('Sobran ', 'Over ')) + money(Math.abs(diff))}
                      </Text>
                    ) : null}
                  </Row>
                );
              })}
            </Card>
          ) : null}

          {sel === 'actual' ? (
            <Card style={{ borderColor: C.gold, borderWidth: 2 }}>
              <H2>{L('Hacer corte', 'Close out')}</H2>
              <P small muted>{L('Cierra estas ventas en un corte a tu nombre. Las ventas nuevas empezarán un corte nuevo.', 'Closes these sales into a close-out under your name. New sales start a new close-out.')}</P>
              <Row style={{ alignItems: 'flex-end' }}>
                {!emp ? <Field label={L('Clave de empleado', 'Employee code')} value={pin} onChangeText={(v) => setPin(digits(v))} secure keyboardType="number-pad" maxLength={6} style={{ maxWidth: 220 }} /> : <P small>{L('Atiende: ', 'Staff: ') + emp.nombre}</P>}
                <Field label={L('Notas (opcional)', 'Notes (optional)')} value={notas} onChangeText={setNotas} placeholder={L('Ej. Cuadra con el banco', 'E.g. Matches the bank')} />
                {!review ? (
                  <Btn icon="check" title={missingCount ? L('Falta contar alguna forma de pago', 'Count every payment method first') : L('Revisar', 'Review')} onPress={() => setReview(true)} disabled={missingCount || (!emp && pin.length < 4)} />
                ) : (
                  <>
                    <Btn icon="check" title={L(`Cerrar corte · ${money(total)}`, `Close out · ${money(total)}`)} onPress={makeCorte} loading={busy} disabled={!emp && pin.length < 4} />
                    <Btn kind="ghost" title={L('Corregir', 'Fix')} onPress={() => setReview(false)} />
                  </>
                )}
              </Row>
              {err ? <Note kind="red">{err}</Note> : null}
            </Card>
          ) : null}
          {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
        </>
      )}
    </Screen>
  );
}
