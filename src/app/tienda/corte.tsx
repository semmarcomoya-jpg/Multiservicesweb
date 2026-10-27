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
import type { Corte, Order } from '@/lib/types';

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
    const rows = list.map((o) => [o.folio, fmt(o.paid_at), o.cliente_nombre, o.cliente_code, title(o), groups.find((g) => g[0] === orderGroup(o))?.[1] || o.kind, o.attended_name || '', 'Zelle', Number(o.monto).toFixed(2), Number(o.fee).toFixed(2), Number(o.total).toFixed(2), o.status]);
    rows.push(['', '', '', '', '', '', '', 'TOTAL', (total - fees).toFixed(2), fees.toFixed(2), total.toFixed(2), '']);
    return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
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
    const { data, error } = await supabase.rpc('make_corte', { p_store: st.id, p_pin: pin, p_notas: notas.trim() }).single<Corte>();
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setPin('');
    setNotas('');
    setMsg(L(`Corte hecho por ${data.employee_name}: ${data.n_orders} ventas, ${money(data.total)}.`, `Close-out by ${data.employee_name}: ${data.n_orders} sales, ${money(data.total)}.`));
    setSel(data.id);
  };

  const cell = { paddingVertical: 8, paddingHorizontal: 8 } as const;

  return (
    <Screen wide>

      <Card>
        <H2>{L('Informe de ventas para el corte', 'Sales report for close-out')}</H2>
        <P small muted>{L('Cuenta los pedidos cuyo pago por Zelle ya confirmó la tienda. Los rechazados no cuentan.', 'Counts orders whose Zelle payment the store already confirmed. Rejected orders are excluded.')}</P>
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
                [L('Total cobrado por Zelle', 'Total collected via Zelle'), money(total)],
                [L('Comisiones y cargos', 'Fees'), money(fees)],
                [L('Monto de servicios y productos', 'Services & products amount'), money(total - fees)],
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

          {sel === 'actual' ? (
            <Card style={{ borderColor: C.gold, borderWidth: 2 }}>
              <H2>{L('Hacer corte', 'Close out')}</H2>
              <P small muted>{L('Cierra estas ventas en un corte a tu nombre. Las ventas nuevas empezarán un corte nuevo.', 'Closes these sales into a close-out under your name. New sales start a new close-out.')}</P>
              <Row style={{ alignItems: 'flex-end' }}>
                <Field label={L('Clave de empleado', 'Employee code')} value={pin} onChangeText={(v) => setPin(digits(v))} secure keyboardType="number-pad" maxLength={6} style={{ maxWidth: 220 }} />
                <Field label={L('Notas (opcional)', 'Notes (optional)')} value={notas} onChangeText={setNotas} placeholder={L('Ej. Cuadra con el banco', 'E.g. Matches the bank')} />
                <Btn icon="check" title={L(`Hacer corte · ${money(total)}`, `Close out · ${money(total)}`)} onPress={makeCorte} loading={busy} disabled={pin.length < 4} />
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
