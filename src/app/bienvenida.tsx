import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Scenery } from '@/components/art';
import { InstallCard } from '@/components/InstallCard';
import { Text } from '@/components/Text';
import { BrandChip, Btn, Circ, LangToggle, P } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function Bienvenida() {
  const { L } = useLang();
  const { height } = useWindowDimensions();
  const heroH = Math.max(280, Math.min(460, height * 0.5));
  const feats: [string, 'gold' | 'blue', string][] = [
    ['send', 'gold', L('Envía a México', 'Send to Mexico')],
    ['bag', 'blue', L('Compra y paga', 'Shop & pay')],
    ['star', 'gold', L('Gana puntos', 'Earn points')],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: '#FFE1C4' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} bounces={false}>
        <View style={{ width: '100%', maxWidth: 520, flexGrow: 1 }}>
          <View style={{ height: heroH, overflow: 'hidden' }}>
            <Scenery />
            <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 16, right: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
                <BrandChip name="Castillo Multiservices" />
                <LangToggle glass />
              </View>
            </SafeAreaView>
          </View>
          <View style={{ flexGrow: 1, marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: C.card, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28, gap: 16 }}>
            <Text style={{ fontSize: 29, fontWeight: '900', color: C.ink, lineHeight: 33 }} accessibilityRole="header">
              {L('Tu familia, más cerca', 'Your family, closer')}
            </Text>
            <P>{L('Envía dinero a México, compra tu celular y paga tus servicios. Y gana puntos en cada movimiento.', 'Send money to Mexico, buy your phone and pay your bills. And earn points with every move.')}</P>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {feats.map(([ic, tone, label]) => (
                <View key={ic} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Circ n={ic} tone={tone} size={44} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, textAlign: 'center' }}>{label}</Text>
                </View>
              ))}
            </View>
            <Btn title={L('Crear mi cuenta', 'Create my account')} onPress={() => router.push('/registro')} />
            <Btn kind="ghost" title={L('Ya tengo cuenta', 'I already have an account')} onPress={() => router.push('/entrar')} />
            <InstallCard />
            <P small style={{ textAlign: 'center', color: C.muted }}>{L('Nunca te pedimos tu estatus migratorio.', 'We never ask about your immigration status.')}</P>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
