import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { EmpGate } from '@/components/EmpGate';
import { useOrderText } from '@/components/orders';
import { usePanelStore } from '@/components/panel';
import { QrScanner } from '@/components/Qr';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Empty, Field, H2, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { modOn, prodName, useProducts, useServices, useStores } from '@/lib/data';
import { useEmp } from '@/lib/emp';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { nextPay } from '@/lib/plans';
import { loyaltyOf, rewardDiscount } from '@/lib/points';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Member, Order, Plan } from '@/lib/types';

type Kind = 'svc' | 'prod' | 'abono';
type Method = 'cash' | 'card' | 'zelle';

export default function Mostrador() {
  const { L, nm, lang } = useLang();
  const { title: oTitle } = useOrderText();
  const { data: stores } = useStores();
  const st = usePanelStore(stores);
  const emp = useEmp(st?.id);
  const { data: services } = useServices();
  const { data: products, reload: reloadProducts } = useProducts(st?.id || null);
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [cust, setCust] = useState<Member | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [kind, setKind] = useState<Kind>('svc');
  const [svcId, setSvcId] = useState<string | null>(null);
  const [opt, setOpt] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [prodId, setProdId] = useState<string | null>(null);
  const [varId, setVarId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [reward, setReward] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [recent, setRecent] = useState<Order[]>([]);

  const loadRecent = useCallback(() => {
    if (!st) return;
    supabase.from('orders').select('*').eq('store_id', st.id).eq('channel', 'store').order('created_at', { ascending: false }).limit(6).then(({ data }) => setRecent((data as Order[]) ?? []));
  }, [st]);
  useFocusEffect(loadRecent);
  const params = useLocalSearchParams<{ code?: string }>();
  const asked = useRef('');
  useEffect(() => {
    if (st && emp && services && params.code && asked.current !== params.code) {
      asked.current = params.code;
      setCode(params.code);
      void find(params.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, emp, services, params.code]);

  if (!stores || !services) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const find = async (c: string) => {
    const v = c.trim().toUpperCase();
    if (!v) return;
    setErr('');
    setMsg('');
    const { data, error } = await supabase.rpc('find_member', { p_store: st.id, p_code: v });
    const m = (data as Member[] | null)?.[0];
    if (error || !m) {
      setCust(null);
      return setErr(error ? errMsg(error) : L('No encontramos ese número de cliente', "We couldn't find that member number"));
    }
    setCode(m.member_code);
    setCust(m);
    setReward('');
    const { data: pl } = await supabase.from('plans').select('*, plan_payments(*)').eq('user_id', m.user_id).eq('store_id', st.id).eq('status', 'activo');
    setPlans((pl as Plan[]) ?? []);
  };

  const ly = loyaltyOf(st);
  const avail = services.filter((s) => s.activo && !(st.svc_off || []).includes(s.id));
  const sv = avail.find((s) => s.id === svcId) || avail[0];
  const prods = (products || []).filter((p) => p.activo);
  const pr = prods.find((p) => p.id === prodId) || prods[0];
  const vr = pr ? pr.product_variants.find((v) => v.id === varId && v.activo) || pr.product_variants.find((v) => v.activo && v.stock > 0) : undefined;
  const pl = plans.find((p) => p.id === planId) || plans[0];
  const plNext = pl ? nextPay(pl) : undefined;

  let base = 0;
  let fee = 0;
  let title = '';
  if (kind === 'svc' && sv) {
    base = sv.price_type === 'fixed' ? Number(sv.base) : sv.price_type === 'options' ? Number(sv.options?.[opt ?? -1]?.p || 0) : Number(amount) || 0;
    fee = Number(sv.fee) || 0;
    title = nm(sv);
  } else if (kind === 'prod' && vr && pr) {
    base = Number(vr.price);
    title = `${prodName(pr)} · ${vr.label}`;
  } else if (kind === 'abono' && plNext && pl) {
    base = Number(plNext.amount);
    title = L('Abono ', 'Payment ') + `${plNext.i}/${pl.n} · ${pl.item_name}`;
  }
  const gross = base + fee;
  const usable = kind !== 'abono' && ly && cust ? ly.rewards.filter((r) => cust.puntos >= r.pts && rewardDiscount(r, gross, fee) > 0) : [];
  const sel = usable.find((r) => r.id === reward);
  const total = gross - (sel ? rewardDiscount(sel, gross, fee) : 0);
  const ptsWin = kind !== 'abono' && ly ? ly.ptsFor(base) : 0;
  const ready = !!cust && !!emp && base > 0 && (kind !== 'prod' || (vr && vr.stock > 0));

  const register = async () => {
    if (!cust || !emp) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const { error } =
      kind === 'abono'
        ? await supabase.rpc('pay_installment', { p_plan: pl!.id, p_pin: emp.pin, p_method: method })
        : await supabase.rpc('counter_sale', {
            p_store: st.id,
            p_pin: emp.pin,
            p_member: cust.member_code,
            p_kind: kind,
            p_service: kind === 'svc' ? sv?.id : null,
            p_option: kind === 'svc' && sv?.price_type === 'options' ? opt : null,
            p_amount: kind === 'svc' && sv?.price_type === 'amount' ? Number(amount) : null,
            p_variant: kind === 'prod' ? vr?.id : null,
            p_method: method,
            p_reward: sel?.id || null,
          });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setMsg(kind === 'abono' ? L(`Abono registrado a ${cust.nombre}`, `Payment recorded for ${cust.nombre}`) : L(`Venta registrada. +${ptsWin} pts para ${cust.nombre}`, `Sale recorded. +${ptsWin} pts for ${cust.nombre}`));
    setAmount('');
    setOpt(null);
    setReward('');
    loadRecent();
    if (kind === 'prod') reloadProducts();
    void find(cust.member_code);
  };

  const kinds: { v: Kind; label: string }[] = [
    ...(modOn(st, 'svc') ? [{ v: 'svc' as Kind, label: L('Servicio', 'Service') }] : []),
    ...(modOn(st, 'shop') ? [{ v: 'prod' as Kind, label: L('Producto', 'Product') }] : []),
    { v: 'abono', label: L('Abono a crédito', 'Credit payment') },
  ];

  return (
    <Screen wide>
      <EmpGate storeId={st.id}>
        <Card>
          <H2>1 · {L('Identifica al cliente', 'Identify the customer')}</H2>
          <P small muted>{L('Escanea su tarjeta QR desde la app o escribe su número de cliente.', 'Scan their QR card from the app or type their member number.')}</P>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={L('Número de cliente', 'Member number')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="CM-000000" autoCapitalize="characters" style={{ maxWidth: 260 }} />
            <Btn title={L('Buscar', 'Find')} disabled={!code.trim()} onPress={() => find(code)} />
            <Btn kind="ghost" icon="qr" title={L('Escanear QR', 'Scan QR')} onPress={() => setScan(true)} />
          </Row>
          {scan ? (
            <QrScanner
              onCode={(c) => {
                setScan(false);
                setCode(c.toUpperCase());
                void find(c);
              }}
              onClose={() => setScan(false)}
            />
          ) : null}
          {cust ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, backgroundColor: C.blueSoft }}>
              <Avatar name={cust.nombre} size={48} uri={cust.foto_url} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>{cust.nombre}</Text>
                <P small>
                  {cust.member_code}
                  {ly ? ` · ${cust.puntos} pts` : ''}
                  {cust.planes ? ' · ' + L(`${cust.planes} crédito(s) activo(s)`, `${cust.planes} active credit(s)`) : ''}
                  {' · '}
                  {cust.id_status === 'verificada' ? L('ID verificada', 'ID verified') : L('Sin ID verificada', 'ID not verified')}
                </P>
              </View>
              <Btn small kind="ghost" title={L('Otro cliente', 'Another')} onPress={() => { setCust(null); setCode(''); setMsg(''); }} />
            </View>
          ) : null}
          {err ? <Note kind="red">{err}</Note> : null}
          {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
        </Card>

        {cust ? (
          <Card>
            <H2>2 · {L('¿Qué paga?', 'What are they paying for?')}</H2>
            <Pills options={kinds} value={kind} onChange={(v) => { setKind(v); setReward(''); }} />
            {kind === 'svc' ? (
              avail.length ? (
                <View style={{ gap: 10 }}>
                  <Pills label={L('Servicio', 'Service')} options={avail.map((s) => ({ v: s.id, label: nm(s), icon: s.icon }))} value={sv?.id} onChange={(v) => { setSvcId(v); setOpt(null); setAmount(''); }} />
                  {sv?.price_type === 'options' ? <Pills label={L('Opción', 'Option')} options={(sv.options || []).map((o, i) => ({ v: i, label: `${nm(o)} · ${money(Number(o.p))}` }))} value={opt} onChange={setOpt} /> : null}
                  {sv?.price_type === 'amount' ? <Field label={L('Monto (USD)', 'Amount (USD)')} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={{ maxWidth: 260 }} /> : null}
                </View>
              ) : (
                <Empty>{L('Esta tienda no tiene servicios activos.', 'No active services in this store.')}</Empty>
              )
            ) : null}
            {kind === 'prod' ? (
              prods.length ? (
                <View style={{ gap: 10 }}>
                  <Pills label={L('Producto', 'Product')} options={prods.map((p) => ({ v: p.id, label: prodName(p) }))} value={pr?.id} onChange={(v) => { setProdId(v); setVarId(null); }} />
                  {pr ? (
                    <Pills
                      label={L('Variante', 'Variant')}
                      options={pr.product_variants.filter((v) => v.activo).map((v) => ({ v: v.id, label: `${v.label} · ${money(Number(v.price))} · ${L('exist. ', 'stock ')}${v.stock}`, disabled: v.stock < 1 }))}
                      value={vr?.id}
                      onChange={setVarId}
                    />
                  ) : null}
                </View>
              ) : (
                <Empty>{L('Esta tienda no tiene productos.', 'This store has no products.')}</Empty>
              )
            ) : null}
            {kind === 'abono' ? (
              plans.length ? (
                <View style={{ gap: 8 }}>
                  <Pills label={L('Crédito', 'Credit')} options={plans.map((p) => ({ v: p.id, label: `${p.folio} · ${p.item_name}` }))} value={pl?.id} onChange={setPlanId} />
                  {plNext && pl ? (
                    <P>{L('Siguiente abono: ', 'Next payment: ') + `${plNext.i}/${pl.n} · ${new Date(plNext.due + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')} · ${money(Number(plNext.amount))}`}</P>
                  ) : null}
                </View>
              ) : (
                <Empty>{L('Este cliente no tiene créditos activos en esta tienda.', 'This customer has no active credit at this store.')}</Empty>
              )
            ) : null}
          </Card>
        ) : null}

        {cust ? (
          <Card>
            <H2>3 · {L('Cobra', 'Charge')}</H2>
            <Pills options={[{ v: 'cash' as Method, label: L('Efectivo', 'Cash') }, { v: 'card' as Method, label: L('Tarjeta', 'Card') }, { v: 'zelle' as Method, label: 'Zelle' }]} value={method} onChange={setMethod} />
            {usable.length ? (
              <Pills
                label={L(`Premios del cliente (${cust.puntos} pts)`, `Customer rewards (${cust.puntos} pts)`)}
                options={[{ v: '', label: L('Sin premio', 'No reward') }, ...usable.map((r) => ({ v: r.id, label: `${(lang === 'es' ? r.es : r.en) || r.es} · ${r.pts} pts` }))]}
                value={reward}
                onChange={setReward}
              />
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ flex: 1, color: C.ink, fontWeight: '700' }}>{title || '—'}</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink }}>{money(total)}</Text>
            </View>
            {sel ? <P small style={{ color: '#1E5B35', fontWeight: '800' }}>{L('Premio aplicado: −', 'Reward applied: −') + money(gross - total)}</P> : null}
            {ptsWin ? <P small style={{ fontWeight: '800', color: C.goldInk }}>{L(`El cliente gana +${ptsWin} pts`, `Customer earns +${ptsWin} pts`)}</P> : null}
            <Btn title={kind === 'abono' ? L('Registrar abono', 'Record payment') : L('Registrar venta', 'Record sale')} icon="check" disabled={!ready} loading={busy} onPress={register} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : null}

        {recent.length ? (
          <Card>
            <H2>{L('Últimos registros en mostrador', 'Latest counter records')}</H2>
            {recent.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>{o.folio} · {o.cliente_nombre} · {oTitle(o)}</Text>
                <Text style={{ color: C.muted }}>{money(Number(o.total))} · {o.attended_name || ''}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </EmpGate>
    </Screen>
  );
}
