import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { EmpGate } from '@/components/EmpGate';
import { usePanelStore } from '@/components/panel';
import { PlanCard } from '@/components/PlanCard';
import { Text } from '@/components/Text';
import { Btn, Card, Empty, Field, H2, Loading, matches, Note, P, Pills, Row, Screen, SearchBox, Toggle } from '@/components/ui';
import { useStores } from '@/lib/data';
import { useEmp } from '@/lib/emp';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { nextPay, planLeft, planState } from '@/lib/plans';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Member, Plan } from '@/lib/types';

type Tab = 'solicitudes' | 'activos' | 'cerrados' | 'lineas';

export default function Creditos() {
  const { L } = useLang();
  const { data: stores } = useStores();
  const st = usePanelStore(stores);
  const emp = useEmp(st?.id);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [tab, setTab] = useState<Tab>('solicitudes');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  // Línea de crédito
  const [code, setCode] = useState('');
  const [mem, setMem] = useState<Member | null>(null);
  const [lineOn, setLineOn] = useState(true);
  const [limit, setLimit] = useState('');

  const load = useCallback(() => {
    if (!st) return;
    supabase.from('plans').select('*, plan_payments(*)').eq('store_id', st.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setPlans((data as Plan[]) ?? []);
    });
  }, [st]);
  useFocusEffect(load);
  const params = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    if (params.code) {
      setTab('lineas');
      setCode(params.code);
      setMem(null);
    }
  }, [params.code]);

  if (!stores || !plans) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const act = plans.filter((p) => p.status === 'activo' && planState(p) !== 'liquidado');
  const req = plans.filter((p) => p.status === 'solicitado');
  const late = act.filter((p) => planState(p) === 'atrasado');
  const closed = plans.filter((p) => !['solicitado', 'activo'].includes(p.status) || planState(p) === 'liquidado');
  const porCobrar = act.reduce((a, p) => a + planLeft(p), 0);

  const run = async (id: string, fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(id);
    setErr('');
    setMsg('');
    const { error } = await fn();
    setBusy('');
    if (error) return setErr(errMsg(error));
    setMsg(ok);
    load();
  };

  const findMem = async () => {
    setErr('');
    const { data, error } = await supabase.rpc('find_member', { p_store: st.id, p_code: code.trim().toUpperCase() });
    const m = (data as Member[] | null)?.[0];
    if (error || !m) return setErr(error ? errMsg(error) : L('No encontramos ese número de cliente', "We couldn't find that member number"));
    setMem(m);
    setLineOn(m.credito_on || !m.credito_limite);
    setLimit(m.credito_limite ? String(m.credito_limite) : '');
  };

  const list = (tab === 'solicitudes' ? req : tab === 'activos' ? act : closed).filter((p) => matches(q, p.folio, p.cliente_nombre, p.cliente_code, p.item_name));

  const stat = (label: string, v: string, red?: boolean) => (
    <View style={{ flex: 1, minWidth: 130, padding: 12, borderRadius: R.md, backgroundColor: red ? '#F7DCD6' : C.blueSoft }}>
      <P small muted style={{ fontWeight: '800' }}>{label}</P>
      <Text style={{ fontSize: 22, fontWeight: '900', color: red ? C.red : C.ink }}>{v}</Text>
    </View>
  );

  return (
    <Screen wide>
      <EmpGate storeId={st.id}>
        <Row style={{ flexWrap: 'wrap' }}>
          {stat(L('Por cobrar', 'Receivable'), money(porCobrar))}
          {stat(L('Créditos activos', 'Active credits'), String(act.length))}
          {stat(L('Atrasados', 'Late'), String(late.length), late.length > 0)}
          {stat(L('Por aprobar', 'To approve'), String(req.length))}
        </Row>
        <Pills
          options={[
            { v: 'solicitudes' as Tab, label: L(`Solicitudes (${req.length})`, `Requests (${req.length})`) },
            { v: 'activos' as Tab, label: L(`Activos (${act.length})`, `Active (${act.length})`) },
            { v: 'cerrados' as Tab, label: L('Cerrados', 'Closed') },
            { v: 'lineas' as Tab, label: L('Línea de crédito', 'Credit line') },
          ]}
          value={tab}
          onChange={(v) => { setTab(v); setMsg(''); setErr(''); }}
        />
        {err ? <Note kind="red">{err}</Note> : null}
        {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}

        {tab === 'lineas' ? (
          <Card>
            <H2>{L('Línea de crédito por cliente', 'Credit line per customer')}</H2>
            <P small muted>{L('Define hasta cuánto puede sacar a crédito cada cliente en esta tienda. Sin línea, el cliente solo puede pedir apartados.', 'Set how much each customer can take on credit at this store. Without a line, the customer can only request layaways.')}</P>
            <Row style={{ alignItems: 'flex-end' }}>
              <Field label={L('Número de cliente', 'Member number')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="CM-000000" autoCapitalize="characters" style={{ maxWidth: 260 }} />
              <Btn title={L('Buscar', 'Find')} disabled={!code.trim()} onPress={findMem} />
            </Row>
            {mem ? (
              <View style={{ gap: 10, padding: 12, borderRadius: R.md, backgroundColor: C.blueSoft }}>
                <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>{mem.nombre} · {mem.member_code}</Text>
                <P small>{mem.id_status === 'verificada' ? L('ID verificada', 'ID verified') : L('Sin ID verificada — te recomendamos verificarla antes de dar crédito.', 'ID not verified — we recommend verifying it before granting credit.')}</P>
                <Toggle label={L('Crédito activo', 'Credit enabled')} value={lineOn} onChange={setLineOn} />
                <Field label={L('Límite (USD)', 'Limit (USD)')} value={limit} onChangeText={(v) => setLimit(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={{ maxWidth: 220 }} />
                <Btn
                  title={L('Guardar línea', 'Save line')}
                  icon="check"
                  loading={busy === 'line'}
                  disabled={!emp}
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => run('line', () => supabase.rpc('set_credit_line', { p_store: st.id, p_pin: emp!.pin, p_member: mem.member_code, p_on: lineOn, p_limit: Number(limit) || 0 }), L(`Línea de ${mem.nombre} guardada`, `${mem.nombre}'s line saved`))}
                />
              </View>
            ) : null}
          </Card>
        ) : (
          <>
            <SearchBox value={q} onChangeText={setQ} placeholder={L('Buscar por cliente, folio o artículo', 'Search by customer, folio or item')} count={list.length} />
            {list.length ? (
              list.map((p) => {
                const nx = nextPay(p);
                return (
                  <PlanCard
                    key={p.id}
                    p={p}
                    staff
                    actions={
                      p.status === 'solicitado' ? (
                        rejecting === p.id ? (
                          <View style={{ gap: 8 }}>
                            <Field label={L('Motivo (lo verá el cliente)', 'Reason (customer will see it)')} value={reason[p.id] || ''} onChangeText={(v) => setReason({ ...reason, [p.id]: v })} />
                            <Row>
                              <Btn small kind="danger" title={L('Rechazar', 'Reject')} loading={busy === p.id} onPress={() => run(p.id, () => supabase.rpc('decide_plan', { p_plan: p.id, p_pin: emp!.pin, p_ok: false, p_reason: reason[p.id] || '' }), L('Solicitud rechazada', 'Request rejected'))} />
                              <Btn small kind="ghost" title={L('Cancelar', 'Cancel')} onPress={() => setRejecting(null)} />
                            </Row>
                          </View>
                        ) : (
                          <Row>
                            <Btn small icon="check" title={L('Aprobar', 'Approve')} loading={busy === p.id} onPress={() => run(p.id, () => supabase.rpc('decide_plan', { p_plan: p.id, p_pin: emp!.pin, p_ok: true, p_reason: '' }), L(`Aprobado. Se generó el cobro del ${p.kind === 'credito' ? 'enganche' : 'primer abono'}.`, 'Approved. The first charge was created.'))} />
                            <Btn small kind="ghost" title={L('Rechazar', 'Reject')} onPress={() => setRejecting(p.id)} />
                          </Row>
                        )
                      ) : p.status === 'activo' && nx ? (
                        <Row style={{ flexWrap: 'wrap' }}>
                          <Btn small icon="cash" title={L(`Cobrar ${money(Number(nx.amount))} en efectivo`, `Collect ${money(Number(nx.amount))} cash`)} loading={busy === p.id + 'cash'} onPress={() => run(p.id + 'cash', () => supabase.rpc('pay_installment', { p_plan: p.id, p_pin: emp!.pin, p_method: 'cash' }), L(`Abono ${nx.i}/${p.n} registrado`, `Payment ${nx.i}/${p.n} recorded`))} />
                          <Btn small kind="ghost" title={L('Con tarjeta', 'By card')} loading={busy === p.id + 'card'} onPress={() => run(p.id + 'card', () => supabase.rpc('pay_installment', { p_plan: p.id, p_pin: emp!.pin, p_method: 'card' }), L(`Abono ${nx.i}/${p.n} registrado`, `Payment ${nx.i}/${p.n} recorded`))} />
                        </Row>
                      ) : null
                    }
                  />
                );
              })
            ) : (
              <Empty>{tab === 'solicitudes' ? L('No hay solicitudes por aprobar.', 'No requests to approve.') : L('Nada por aquí.', 'Nothing here.')}</Empty>
            )}
          </>
        )}
      </EmpGate>
    </Screen>
  );
}
