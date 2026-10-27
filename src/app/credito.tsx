import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PlanCard } from '@/components/PlanCard';
import { Text } from '@/components/Text';
import { BackBar, Btn, Card, Empty, H1, Loading, Note, P, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { storeShort, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { nextPay, planLeft, planState } from '@/lib/plans';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { CreditLine, Order, Plan } from '@/lib/types';

export default function Credito() {
  const { L } = useLang();
  const { session } = useAuth();
  const { data: stores } = useStores();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [lines, setLines] = useState<CreditLine[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!session) return;
    supabase.from('plans').select('*, plan_payments(*)').eq('user_id', session.user.id).order('created_at', { ascending: false }).then(({ data }) => setPlans((data as Plan[]) ?? []));
    supabase.from('credit_lines').select('*').eq('user_id', session.user.id).then(({ data }) => setLines((data as CreditLine[]) ?? []));
  }, [session]);
  useFocusEffect(load);

  if (!plans || !stores) return <Loading />;
  const name = (id: string) => {
    const s = stores.find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };
  const payZelle = async (p: Plan) => {
    setBusy(p.id);
    setErr('');
    const { data, error } = await supabase.rpc('create_abono_order', { p_plan: p.id }).single<Order>();
    setBusy('');
    if (error) return setErr(errMsg(error));
    router.push({ pathname: '/pedido/[id]', params: { id: data.id, nuevo: '1' } });
  };

  return (
    <Screen wall="profile">
      <BackBar title={L('Mi crédito', 'My credit')} />
      <H1>{L('Crédito y apartado', 'Credit & layaway')}</H1>
      {lines.filter((l) => l.on).map((l) => {
        const used = plans.filter((p) => p.store_id === l.store_id && p.kind === 'credito' && (p.status === 'activo' || p.status === 'solicitado')).reduce((a, p) => a + planLeft(p), 0);
        const lim = Number(l.limite);
        const avail = Math.max(0, lim - used);
        return (
          <Card key={l.store_id}>
            <P small muted style={{ fontWeight: '800' }}>{L('Tu línea de crédito en ', 'Your credit line at ') + name(l.store_id)}</P>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 34, fontWeight: '900', color: C.ink }}>{money(avail)}</Text>
              <Text style={{ color: C.muted, fontWeight: '800' }}>{L('disponible', 'available')}</Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: C.tint, overflow: 'hidden' }}>
              <View style={{ width: `${lim ? Math.min(100, Math.round((used / lim) * 100)) : 0}%`, height: '100%', backgroundColor: C.gold }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <P small>{L('Límite ', 'Limit ') + money(lim)}</P>
              <P small>{L('Por pagar ', 'Owed ') + money(used)}</P>
            </View>
          </Card>
        );
      })}
      {!lines.some((l) => l.on) ? (
        <Note kind="gold" icon="wallet">{L('Aún no tienes línea de crédito. Tu tienda la puede habilitar según tu historial. Mientras tanto puedes apartar productos.', "You don't have a credit line yet. Your store can enable it based on your history. Meanwhile you can use layaway.")}</Note>
      ) : null}
      {err ? <Note kind="red">{err}</Note> : null}
      {plans.length === 0 ? (
        <Empty>{L('Aún no tienes compras a crédito ni apartados. En la tienda, abre un producto y toca "Ver planes de pago".', 'No credit purchases or layaways yet. In the shop, open a product and tap "See payment plans".')}</Empty>
      ) : null}
      {plans.map((p) => {
        const st = planState(p);
        const nx = nextPay(p);
        return (
          <PlanCard
            key={p.id}
            p={p}
            storeName={name(p.store_id)}
            actions={
              <>
                {st === 'solicitado' ? (
                  <Note kind="gold">
                    {p.kind === 'credito'
                      ? L(`Tu tienda está revisando tu solicitud. Te avisamos aquí. El enganche de ${money(p.down)} se paga al recoger tu equipo.`, `Your store is reviewing your request. The ${money(p.down)} down payment is paid at pickup.`)
                      : L(`Tu tienda está revisando tu apartado. El primer abono de ${money(p.down)} lo pagas en tienda.`, `Your store is reviewing your layaway. Pay the first ${money(p.down)} in store.`)}
                  </Note>
                ) : null}
                {nx && (st === 'corriente' || st === 'atrasado') ? (
                  <Btn title={L('Pagar abono con Zelle · ', 'Pay with Zelle · ') + money(nx.amount)} loading={busy === p.id} onPress={() => payZelle(p)} />
                ) : null}
                {p.kind === 'apartado' && st === 'liquidado' ? <Note kind="blue">{L('¡Ya terminaste de pagar! Pasa a recoger tu producto.', 'All paid! Come pick up your product.')}</Note> : null}
              </>
            }
          />
        );
      })}
      <Note kind="blue" icon="qr">{L('¿Prefieres pagar en efectivo? Ve a tu tienda y muestra tu tarjeta QR. El abono aparece aquí al momento.', 'Prefer cash? Go to your store and show your QR card. The payment shows up here right away.')}</Note>
    </Screen>
  );
}
