import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { OrderRow } from '@/components/orders';
import { Card, Empty, H2, IcoBox, Icon, P, Row, Screen, TopBar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, useSettings, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { useMyOrders } from '@/lib/myorders';
import { C, R } from '@/lib/theme';

export default function Inicio() {
  const { L } = useLang();
  const { profile } = useAuth();
  const { data: cfg } = useSettings();
  const { data: stores } = useStores();
  const { orders } = useMyOrders(5);
  const any = (k: 'send' | 'svc') => (stores || []).some((st) => st.activo && modOn(st, k));

  const actions = [
    any('send') && { ic: 'send', label: L('Enviar dinero', 'Send money'), go: '/enviar' },
    any('svc') && { ic: 'tool', label: L('Servicios', 'Services'), go: '/servicios' },
    { ic: 'users', label: L('Mis beneficiarios', 'My recipients'), go: '/beneficiarios' },
    { ic: 'receipt', label: L('Mis pedidos', 'My orders'), go: '/pedidos' },
  ].filter(Boolean) as { ic: string; label: string; go: string }[];

  return (
    <Screen>
      <TopBar />
      <Card style={{ gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.ink }}>
          {L('Hola', 'Hi')}, {profile?.nombre || ''}
        </Text>
        <View style={{ backgroundColor: C.blueSoft, borderRadius: R.md, padding: 14 }}>
          <P small style={{ color: C.blueInk }}>{L('Tipo de cambio de hoy', "Today's exchange rate")}</P>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.blueInk }}>1 USD = {cfg ? Number(cfg.exchange_rate).toFixed(2) : '—'} MXN</Text>
        </View>
      </Card>

      {any('send') ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/enviar')} style={{ backgroundColor: C.brown, borderRadius: R.xl, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{L('Enviar dinero a México', 'Send money to Mexico')}</Text>
            <Text style={{ color: C.goldSoft }}>{L('Rápido, seguro y con comprobante', 'Fast, safe and with a receipt')}</Text>
          </View>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="arrow" size={26} color={C.ink} sw={2.4} />
          </View>
        </Pressable>
      ) : null}

      <H2>{L('¿Qué quieres hacer hoy?', 'What would you like to do today?')}</H2>
      <Row gap={10}>
        {actions.map((a) => (
          <Pressable
            key={a.go}
            accessibilityRole="button"
            onPress={() => router.push(a.go as never)}
            style={{ flexGrow: 1, flexBasis: 140, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10, alignItems: 'flex-start' }}
          >
            <IcoBox n={a.ic} size={42} />
            <Text style={{ fontWeight: '900', color: C.ink, fontSize: 15 }}>{a.label}</Text>
          </Pressable>
        ))}
      </Row>

      <H2>{L('Tus pedidos recientes', 'Your recent orders')}</H2>
      {orders && orders.length === 0 ? <Empty>{L('Aún no tienes pedidos.', 'No orders yet.')}</Empty> : null}
      {(orders || []).map((o) => (
        <OrderRow key={o.id} o={o} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: o.id } })} />
      ))}
    </Screen>
  );
}
