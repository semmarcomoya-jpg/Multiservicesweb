import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { usePlanText } from '@/components/PlanCard';
import { Text } from '@/components/Text';
import { BackBar, Btn, Card, Field, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, prodName, useQuery, useSettings, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { DEFAULT_CREDIT, freqOn, nOptions, planLeft, previewPlan } from '@/lib/plans';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { CreditLine, Plan, Product } from '@/lib/types';

export default function PlanDePagos() {
  const { L, lang } = useLang();
  const { variant } = useLocalSearchParams<{ variant: string }>();
  const { session } = useAuth();
  const { data: cfgRow } = useSettings();
  const { data: stores } = useStores();
  const { data: vrow } = useQuery<{ products: Product } | null>(() => supabase.from('product_variants').select('id, products(*, product_variants(*))').eq('id', variant).maybeSingle(), [variant]);
  const prod = vrow === undefined ? undefined : vrow?.products ?? null;
  const { data: lines } = useQuery<CreditLine[]>(() => supabase.from('credit_lines').select('*'), []);
  const { data: myPlans } = useQuery<Plan[]>(() => supabase.from('plans').select('*, plan_payments(*)').in('status', ['solicitado', 'activo']), []);
  const { freqName, freqPl } = usePlanText();
  const [kind, setKind] = useState<'credito' | 'apartado' | null>(null);
  const [freq, setFreq] = useState<'semanal' | 'quincenal' | 'mensual' | null>(null);
  const [n, setN] = useState<number | null>(null);
  const [down, setDown] = useState('');
  const [accept, setAccept] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!cfgRow || !stores || prod === undefined || !session) return <Loading />;
  const v = prod?.product_variants?.find((x) => x.id === variant);
  if (!prod || !v) return <Loading />;
  const cfg = { ...DEFAULT_CREDIT, ...(cfgRow.credit || {}) };
  const st = stores.find((s) => s.id === prod.store_id);
  const price = Number(v.price);
  const minDown = Math.ceil(price * Number(cfg.minDown)) / 100;
  const dn = Math.max(minDown, Number(down) || 0);
  const line = (lines || []).find((l) => l.store_id === prod.store_id && l.on);
  const used = (myPlans || []).filter((p) => p.store_id === prod.store_id && p.kind === 'credito').reduce((a, p) => a + planLeft(p), 0);
  const avail = line ? Math.max(0, Number(line.limite) - used) : 0;
  const fins = (k: 'credito' | 'apartado') => (price - dn) * (1 + (k === 'credito' ? Number(cfg.rate) : 0) / 100);
  const creditOk = cfg.on && !!st && modOn(st, 'credit') && !!line && price >= Number(cfg.minPrice) && fins('credito') <= avail + 0.001;
  const kinds: ('credito' | 'apartado')[] = [];
  if (creditOk) kinds.push('credito');
  if (cfg.layaway && st && modOn(st, 'layaway')) kinds.push('apartado');
  const k = kind && kinds.includes(kind) ? kind : kinds[0];
  const fs = freqOn(cfg);
  const f = freq && fs.includes(freq) ? freq : fs[0];
  const ns = nOptions(cfg);
  const nn = n && ns.includes(n) ? n : ns[0];
  const pv = k && f && nn ? previewPlan(price, dn, nn, f, k === 'credito' ? Number(cfg.rate) : 0) : null;
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const submit = async () => {
    setTried(true);
    if (!accept || !k || !f || !nn) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('request_plan', { p_variant: v.id, p_kind: k, p_freq: f, p_n: nn, p_down: dn });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    router.replace('/credito');
  };

  return (
    <Screen
      wall="shop"
      footer={<Btn title={L('Enviar solicitud a mi tienda', 'Send request to my store')} disabled={!kinds.length} loading={busy} onPress={submit} />}
    >
      <BackBar title={L('Plan de pagos', 'Payment plan')} />
      <Row gap={12} style={{ flexWrap: 'nowrap' }}>
        <IcoBox n="phone" size={52} />
        <View style={{ flex: 1 }}>
          <H1 style={{ fontSize: 22 }}>{prodName(prod)}</H1>
          <P muted>{v.label} · {money(price)}</P>
        </View>
      </Row>
      {kinds.length === 0 ? <Note kind="gold">{L('Este producto no tiene planes de pago disponibles.', 'No payment plans for this product.')}</Note> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {kinds.map((x) => (
          <Pressable key={x} accessibilityRole="radio" accessibilityState={{ checked: k === x }} onPress={() => setKind(x)}
            style={{ flex: 1, padding: 14, borderRadius: R.lg, borderWidth: 2, borderColor: k === x ? C.brown : C.line, backgroundColor: k === x ? C.tint : C.card, gap: 6 }}>
            <IcoBox n={x === 'credito' ? 'wallet' : 'calendar'} size={36} />
            <Text style={{ fontWeight: '900', color: C.ink }}>{x === 'credito' ? L('Llévatelo hoy', 'Take it today') : L('Apártalo', 'Layaway')}</Text>
            <P small muted>{x === 'credito' ? L('Pagas en abonos', 'Pay in installments') : L('Te lo llevas al terminar de pagar', 'Take it home when paid off')}</P>
          </Pressable>
        ))}
      </View>
      {!creditOk && cfg.on && st && modOn(st, 'credit') ? (
        <P small muted>{line ? L(`Tu crédito disponible es ${money(avail)}. Puedes subir el enganche o apartarlo.`, `Your available credit is ${money(avail)}. Raise the down payment or use layaway.`) : L('Para llevártelo hoy necesitas una línea de crédito. Pídela en tu tienda.', 'To take it today you need a credit line. Ask your store.')}</P>
      ) : null}
      {k ? (
        <Card>
          <Pills label={L('¿Cada cuándo pagas?', 'How often do you pay?')} options={fs.map((x) => ({ v: x, label: freqName(x) }))} value={f} onChange={setFreq} />
          <Pills label={L('¿En cuántos pagos?', 'How many payments?')} options={ns.map((x) => ({ v: x, label: String(x) }))} value={nn} onChange={setN} />
          <Field label={k === 'credito' ? L('Enganche (USD)', 'Down payment (USD)') : L('Primer abono (USD)', 'First payment (USD)')} value={down} onChangeText={(t) => setDown(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={minDown.toFixed(2)}
            hint={L(`Mínimo ${money(minDown)} (${cfg.minDown}%)`, `Minimum ${money(minDown)} (${cfg.minDown}%)`)} />
          {pv && nn && f ? (
            <View style={{ padding: 14, borderRadius: R.md, backgroundColor: C.cream, gap: 6 }}>
              <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{L(`${nn} pagos ${freqPl(f)} de ${money(pv.each)}`, `${nn} ${freqPl(f)} payments of ${money(pv.each)}`)}</Text>
              {[
                [L('Precio', 'Price'), money(price)],
                [k === 'credito' ? L('Enganche', 'Down payment') : L('Primer abono', 'First payment'), money(dn)],
                [L('Por pagar en abonos', 'Paid in installments'), money(pv.fin)],
                ...(k === 'credito' ? [[L('Cargo por financiamiento', 'Finance charge'), Number(cfg.rate) ? cfg.rate + '%' : L('Sin cargo', 'None')]] : []),
                [L('Total a pagar', 'Total to pay'), money(dn + pv.fin)],
                [L('Primer pago', 'First payment due'), fmt(pv.sched[0].due)],
                [L('Último pago', 'Last payment due'), fmt(pv.sched[pv.sched.length - 1].due)],
              ].map(([a, b]) => (
                <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <P small>{a}</P>
                  <P small style={{ fontWeight: '800' }}>{b}</P>
                </View>
              ))}
            </View>
          ) : null}
          <Note kind="gold">
            {k === 'credito'
              ? L(`Si te atrasas, después de ${cfg.grace} días de gracia se cobra un cargo de ${money(Number(cfg.lateFee))}. Te recordamos cada pago aquí.`, `If you are late, after ${cfg.grace} grace days a ${money(Number(cfg.lateFee))} fee applies. We remind you of each payment here.`)
              : L(`Guardamos tu producto hasta ${cfg.layDays} días. Te lo entregamos cuando termines de pagar.`, `We hold your product for up to ${cfg.layDays} days. You take it home once it is paid off.`)}
          </Note>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accept }} onPress={() => setAccept(!accept)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: accept ? C.brown : C.line2, backgroundColor: accept ? C.brown : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {accept ? <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1, color: C.ink, fontWeight: '700' }}>{L('Acepto el plan de pagos y sus condiciones.', 'I accept the payment plan and its terms.')}</Text>
          </Pressable>
          {tried && !accept ? <Text style={{ color: C.red, fontWeight: '700' }}>{L('Acepta el plan para continuar', 'Accept the plan to continue')}</Text> : null}
          <Label>{' '}</Label>
        </Card>
      ) : null}
      {err ? <Note kind="red">{err}</Note> : null}
    </Screen>
  );
}
