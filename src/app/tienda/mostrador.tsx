import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { EmpGate } from '@/components/EmpGate';
import { useOrderText } from '@/components/orders';
import { usePanelStore } from '@/components/panel';
import { QrScanner } from '@/components/Qr';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Empty, Field, H2, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { Scene, sceneFor } from '@/components/scenes';
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
interface Line { key: string; kind: 'svc' | 'prod'; service?: string; option?: number | null; amount?: number | null; variant?: string; qty: number; label: string; unit: number; fee: number; stock?: number }

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
  const [cart, setCart] = useState<Line[]>([]);
  const [disc, setDisc] = useState(0);
  const [recibido, setRecibido] = useState('');
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

  // Lo que se está eligiendo ahora (antes de agregarlo a la venta)
  let base = 0;
  let fee = 0;
  let title = '';
  if (kind === 'svc' && sv) {
    base = sv.price_type === 'fixed' ? Number(sv.base) : sv.price_type === 'options' ? Number(sv.options?.[opt ?? -1]?.p || 0) : Number(amount) || 0;
    fee = Number(sv.fee) || 0;
    title = nm(sv) + (sv.price_type === 'options' && opt != null && sv.options?.[opt] ? ' · ' + nm(sv.options[opt]) : '');
  } else if (kind === 'prod' && vr && pr) {
    base = Number(vr.price);
    title = `${prodName(pr)} · ${vr.label}`;
  } else if (kind === 'abono' && plNext && pl) {
    base = Number(plNext.amount);
    title = L('Abono ', 'Payment ') + `${plNext.i}/${pl.n} · ${pl.item_name}`;
  }
  const inCart = (vid?: string) => cart.filter((x) => x.variant === vid).reduce((a, x) => a + x.qty, 0);
  const canAdd = kind !== 'abono' && base > 0 && (kind !== 'prod' || (!!vr && vr.stock > inCart(vr?.id)));
  const addLine = () => {
    if (!canAdd) return;
    const key = kind === 'svc' ? `s:${sv!.id}:${opt ?? ''}:${sv!.price_type === 'amount' ? amount : ''}` : `p:${vr!.id}`;
    setCart((c) => {
      const ex = c.find((x) => x.key === key);
      if (ex) return c.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
      return [...c, kind === 'svc'
        ? { key, kind: 'svc', service: sv!.id, option: sv!.price_type === 'options' ? opt : null, amount: sv!.price_type === 'amount' ? Number(amount) : null, qty: 1, label: title, unit: base, fee }
        : { key, kind: 'prod', variant: vr!.id, qty: 1, label: title, unit: base, fee: 0, stock: vr!.stock }];
    });
    setAmount('');
    setMsg('');
  };
  // Agregar con un toque desde los cuadritos (servicio de precio fijo o variante de producto)
  const push = (line: Line) => {
    setCart((c) => {
      const ex = c.find((x) => x.key === line.key);
      if (ex) return c.map((x) => (x.key === line.key ? { ...x, qty: Math.min(x.stock ?? 20, x.qty + 1) } : x));
      return [...c, line];
    });
    setMsg('');
  };
  const qtyOf = (key: string) => cart.find((x) => x.key === key)?.qty || 0;
  const setQty = (key: string, d: number) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(0, Math.min(x.stock ?? 20, x.qty + d)) } : x)).filter((x) => x.qty > 0));

  // Totales de la venta (el servidor vuelve a calcular todo)
  const lineTotal = (x: Line) => (x.unit + x.fee) * x.qty;
  const gross = kind === 'abono' ? base : cart.reduce((a, x) => a + lineTotal(x), 0);
  const fees = cart.reduce((a, x) => a + x.fee * x.qty, 0);
  const usable = kind !== 'abono' && ly && cust && cart.length ? ly.rewards.filter((r) => cust.puntos >= r.pts && cart.some((x) => rewardDiscount(r, x.unit + x.fee, x.fee) > 0)) : [];
  const sel = usable.find((r) => r.id === reward);
  // El premio se aplica al artículo donde rinde más; ese va primero
  const ordered = [...cart].sort((x, y) => (sel ? rewardDiscount(sel, y.unit + y.fee, y.fee) - rewardDiscount(sel, x.unit + x.fee, x.fee) : 0));
  const rewardOff = sel && ordered[0] ? rewardDiscount(sel, ordered[0].unit + ordered[0].fee, ordered[0].fee) : 0;
  const pctOff = kind === 'abono' ? 0 : Math.round((gross - rewardOff) * disc) / 100;
  const total = Math.max(0, gross - rewardOff - pctOff);
  const rec = parseFloat(recibido) || 0;
  const change = rec - total;
  const ptsWin = kind !== 'abono' && ly ? cart.reduce((a, x) => a + ly.ptsFor(x.unit) * x.qty, 0) : 0;
  const lack = !cust
    ? L('Primero identifica al cliente', 'Identify the customer first')
    : kind === 'abono'
      ? !plNext ? L('Este cliente no tiene abonos pendientes', 'No pending payments') : ''
      : !cart.length
        ? L('Agrega algo a la venta', 'Add something to the sale')
        : method === 'cash' && recibido !== '' && rec < total ? L(`Faltan ${money(total - rec)} de lo que te dio`, `${money(total - rec)} short`) : '';

  const register = async () => {
    if (!cust || !emp || lack) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const { data, error } =
      kind === 'abono'
        ? await supabase.rpc('pay_installment', { p_plan: pl!.id, p_pin: emp.pin, p_method: method })
        : await supabase.rpc('counter_cart', {
            p_store: st.id,
            p_pin: emp.pin,
            p_member: cust.member_code,
            p_lines: ordered.map((x) => (x.kind === 'svc' ? { kind: 'svc', service: x.service, option: x.option, amount: x.amount, qty: x.qty } : { kind: 'prod', variant: x.variant, qty: x.qty })),
            p_method: method,
            p_reward: sel?.id || null,
            p_disc: disc,
          });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    const n = Array.isArray(data) ? data.length : 1;
    setMsg(
      kind === 'abono'
        ? L(`Abono registrado a ${cust.nombre}`, `Payment recorded for ${cust.nombre}`)
        : L(`Venta registrada (${n} ${n === 1 ? 'artículo' : 'artículos'}) · ${money(total)}`, `Sale recorded (${n} item${n === 1 ? '' : 's'}) · ${money(total)}`) +
            (method === 'cash' && rec > total ? L(` · Cambio ${money(change)}`, ` · Change ${money(change)}`) : '') +
            (ptsWin ? L(` · +${ptsWin} pts para ${cust.nombre}`, ` · +${ptsWin} pts for ${cust.nombre}`) : ''),
    );
    setCart([]);
    setDisc(0);
    setRecibido('');
    setReward('');
    loadRecent();
    reloadProducts();
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
              <Btn small kind="ghost" title={L('Otro cliente', 'Another')} onPress={() => { setCust(null); setCode(''); setMsg(''); setCart([]); setDisc(0); setRecibido(''); }} />
            </View>
          ) : null}
          {err ? <Note kind="red">{err}</Note> : null}
          {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        {cust ? (
          <Card style={{ flexGrow: 1.3, flexBasis: 420, minWidth: 0 }}>
            <H2>2 · {L('¿Qué paga?', 'What are they paying for?')}</H2>
            <Pills options={kinds} value={kind} onChange={(v) => { setKind(v); setReward(''); }} />
            {kind === 'svc' ? (
              avail.length ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {avail.map((x) => {
                      const k = `s:${x.id}::`;
                      const n = qtyOf(k);
                      const on = sv?.id === x.id;
                      return (
                        <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={nm(x)}
                          onPress={() => {
                            if (x.price_type === 'fixed' && Number(x.base) > 0) push({ key: k, kind: 'svc', service: x.id, option: null, amount: null, qty: 1, label: nm(x), unit: Number(x.base), fee: Number(x.fee) || 0 });
                            setSvcId(x.id); setOpt(null); setAmount('');
                          }}
                          style={{ width: '31%', flexGrow: 1, maxWidth: 200, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? C.brown : C.line, backgroundColor: C.card, overflow: 'hidden' }}>
                          {n ? <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{n}</Text></View> : null}
                          <View style={{ height: 52, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n={sceneFor(x.icon, x.cat_id)} size={48} /></View>
                          <View style={{ padding: 8 }}>
                            <Text style={{ fontWeight: '800', fontSize: 13, color: C.ink }} numberOfLines={2}>{nm(x)}</Text>
                            <Text style={{ fontSize: 12, color: C.muted }}>{x.price_type === 'fixed' ? money(Number(x.base)) : x.price_type === 'amount' ? L('Tú pones el monto', 'Custom amount') : L('Con opciones', 'With options')}{Number(x.fee) ? ` + ${money(Number(x.fee))}` : ''}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
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
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {prods.flatMap((p) => p.product_variants.filter((v) => v.activo).map((v) => {
                      const k = `p:${v.id}`;
                      const n = qtyOf(k);
                      const left = v.stock - n;
                      return (
                        <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`${prodName(p)} ${v.label}`} disabled={left <= 0}
                          onPress={() => push({ key: k, kind: 'prod', variant: v.id, qty: 1, label: `${prodName(p)} · ${v.label}`, unit: Number(v.price), fee: 0, stock: v.stock })}
                          style={{ width: '31%', flexGrow: 1, maxWidth: 200, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: 'hidden', opacity: left <= 0 ? 0.5 : 1 }}>
                          {n ? <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{n}</Text></View> : null}
                          <View style={{ height: 52, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}>
                            {p.foto_url ? <Image source={{ uri: p.foto_url }} style={{ width: '100%', height: 52 }} resizeMode="contain" /> : <Scene n={p.family_id === 'cel' ? 'celular' : p.family_id === 'chip' ? 'recarga' : p.family_id === 'reg' ? 'puntos' : 'funda'} size={48} />}
                          </View>
                          <View style={{ padding: 8 }}>
                            <Text style={{ fontWeight: '800', fontSize: 13, color: C.ink }} numberOfLines={2}>{`${prodName(p)} · ${v.label}`}</Text>
                            <Text style={{ fontSize: 12, color: C.muted }}>{money(Number(v.price))}</Text>
                            <Text style={{ fontSize: 12, color: left <= 1 ? C.red : C.muted }}>{left > 0 ? L(`Quedan ${left}`, `${left} left`) : L('Agotado', 'Sold out')}</Text>
                          </View>
                        </Pressable>
                      );
                    }))}
                  </View>
                </View>
              ) : (
                <Empty>{L('Esta tienda no tiene productos.', 'This store has no products.')}</Empty>
              )
            ) : null}
            {kind === 'svc' && sv && sv.price_type !== 'fixed' ? (
              <Row style={{ alignItems: 'center' }}>
                <Btn icon="plus" title={canAdd ? L(`Agregar a la venta · ${money(base + fee)}`, `Add to sale · ${money(base + fee)}`) : L('Elige la opción o escribe el monto', 'Choose the option or type the amount')} disabled={!canAdd} onPress={addLine} />
                {cart.length ? <P small muted>{L(`${cart.reduce((a, x) => a + x.qty, 0)} en la venta`, `${cart.reduce((a, x) => a + x.qty, 0)} in the sale`)}</P> : null}
              </Row>
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
          <Card style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}>
            <H2>3 · {L('Cobra', 'Charge')}</H2>
            {kind !== 'abono' ? (
              cart.length ? (
                <View style={{ gap: 2 }}>
                  {cart.map((x) => (
                    <View key={x.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <Text style={{ flex: 1, color: C.ink, fontWeight: '700' }} numberOfLines={2}>{x.label}{x.fee ? <Text style={{ color: C.muted, fontWeight: '600' }}>{L(` + ${money(x.fee)} comisión`, ` + ${money(x.fee)} fee`)}</Text> : null}</Text>
                      <Row gap={6} style={{ flexWrap: 'nowrap' }}>
                        <Btn small kind="ghost" title="−" onPress={() => setQty(x.key, -1)} />
                        <Text style={{ fontWeight: '900', color: C.ink, minWidth: 18, textAlign: 'center' }}>{x.qty}</Text>
                        <Btn small kind="ghost" title="+" onPress={() => setQty(x.key, 1)} disabled={x.stock != null && x.qty >= x.stock} />
                      </Row>
                      <Text style={{ fontWeight: '900', color: C.ink, minWidth: 80, textAlign: 'right' }}>{money(lineTotal(x))}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <P small muted>{L('Agrega servicios o productos arriba; puedes cobrar varios en una sola venta.', 'Add services or products above; you can charge several in one sale.')}</P>
              )
            ) : (
              <Text style={{ color: C.ink, fontWeight: '700' }}>{title || '—'}</Text>
            )}
            {kind !== 'abono' && cart.length ? (
              <Pills label={L('Descuento', 'Discount')} options={[0, 5, 10, 15, 20].map((p) => ({ v: p, label: p ? `${p} %` : L('Sin descuento', 'None') }))} value={disc} onChange={setDisc} />
            ) : null}
            {usable.length ? (
              <Pills
                label={L(`Premios del cliente (${cust.puntos} pts)`, `Customer rewards (${cust.puntos} pts)`)}
                options={[{ v: '', label: L('Sin premio', 'No reward') }, ...usable.map((r) => ({ v: r.id, label: `${(lang === 'es' ? r.es : r.en) || r.es} · ${r.pts} pts` }))]}
                value={reward}
                onChange={setReward}
              />
            ) : null}
            <Pills label={L('Forma de pago', 'Payment method')} options={[{ v: 'cash' as Method, label: L('Efectivo', 'Cash') }, { v: 'card' as Method, label: L('Tarjeta', 'Card') }, { v: 'zelle' as Method, label: 'Zelle' }]} value={method} onChange={setMethod} />
            {method === 'cash' && (kind === 'abono' ? base > 0 : cart.length > 0) ? (
              <Row style={{ alignItems: 'flex-end' }}>
                <Field label={L('Recibido (opcional)', 'Received (optional)')} value={recibido} onChangeText={(v) => setRecibido(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" style={{ maxWidth: 180 }} />
                {[20, 50, 100, 200].filter((v) => v >= total).slice(0, 3).map((v) => (
                  <Btn key={v} small kind="ghost" title={`$${v}`} onPress={() => setRecibido(String(v))} />
                ))}
                {recibido !== '' && rec >= total ? <Text style={{ fontWeight: '900', color: '#1E5B35', fontSize: 16 }}>{L('Cambio ', 'Change ') + money(change)}</Text> : null}
              </Row>
            ) : null}
            <View style={{ gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              {fees ? <P small muted>{L('Comisiones incluidas: ', 'Fees included: ') + money(fees)}</P> : null}
              {rewardOff ? <P small style={{ color: '#1E5B35', fontWeight: '800' }}>{L('Premio: −', 'Reward: −') + money(rewardOff)}</P> : null}
              {pctOff ? <P small style={{ color: '#1E5B35', fontWeight: '800' }}>{L(`Descuento ${disc} %: −`, `Discount ${disc} %: −`) + money(pctOff)}</P> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16 }}>Total</Text>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink }}>{money(total)}</Text>
              </View>
              {ptsWin ? <P small style={{ fontWeight: '800', color: C.goldInk }}>{L(`El cliente gana +${ptsWin} pts`, `Customer earns +${ptsWin} pts`)}</P> : null}
            </View>
            <Btn title={lack || (kind === 'abono' ? L(`Registrar abono · ${money(total)}`, `Record payment · ${money(total)}`) : L(`Registrar venta · ${money(total)}`, `Record sale · ${money(total)}`))} icon={lack ? undefined : 'check'} disabled={!!lack || !emp} loading={busy} onPress={register} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : null}

        </View>
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
