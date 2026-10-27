import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Btn, Card, Col, IcoBox, P, Row, Screen, TopBar } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function Bienvenida() {
  const { L } = useLang();
  const items = [
    ['send', L('Envía dinero a México', 'Send money to Mexico'), L('A cuenta o para recoger en efectivo', 'To a bank account or cash pickup')],
    ['bolt', L('Paga tus servicios', 'Pay your bills'), L('Luz, agua, recargas y más, sin salir de casa', 'Power, water, top-ups and more, from home')],
    ['shield', L('Seguro y con comprobante', 'Safe, with a receipt'), L('Pagas por Zelle y te mandamos tu comprobante', 'Pay with Zelle and get your receipt')],
  ];
  return (
    <Screen>
      <TopBar />
      <View style={{ backgroundColor: C.brown, borderRadius: 24, padding: 24, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 34 }}>{L('Tu tienda de confianza, ahora en tu celular', 'Your trusted store, now on your phone')}</Text>
        <Text style={{ color: C.goldSoft, fontSize: 16, lineHeight: 22 }}>
          {L('Envíos, pagos y trámites en español e inglés. Te atendemos como en la tienda.', 'Transfers, payments and paperwork in Spanish and English. Same care as in the store.')}
        </Text>
      </View>
      <Card>
        {items.map(([ic, t, d]) => (
          <Row key={ic} gap={12} style={{ flexWrap: 'nowrap' }}>
            <IcoBox n={ic} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{t}</Text>
              <P muted small>{d}</P>
            </View>
          </Row>
        ))}
      </Card>
      <Col>
        <Btn title={L('Crear mi cuenta', 'Create my account')} onPress={() => router.push('/registro')} />
        <Btn kind="ghost" title={L('Ya tengo cuenta', 'I already have an account')} onPress={() => router.push('/entrar')} />
      </Col>
      <P small muted style={{ textAlign: 'center' }}>
        {L('Nunca te pedimos tu estatus migratorio.', 'We never ask about your immigration status.')}
      </P>
    </Screen>
  );
}
