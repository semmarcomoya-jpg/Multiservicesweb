import { router } from 'expo-router';
import React from 'react';
import { Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Scenery } from '@/components/art';
import { InstallCard } from '@/components/InstallCard';
import { Text } from '@/components/Text';
import { BrandChip, Btn, Circ, LangToggle, P } from '@/components/ui';
import { useBranding } from '@/lib/branding';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function Bienvenida() {
  const { L, lang } = useLang();
  const { brand } = useBranding();
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
            {brand.cover_url ? <Image source={{ uri: brand.cover_url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : <Scenery />}
            <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 16, right: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
                <BrandChip full />
                <LangToggle glass />
              </View>
            </SafeAreaView>
          </View>
          <View style={{ flexGrow: 1, marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: C.card, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28, gap: 16 }}>
            <Text style={{ fontSize: 29, fontWeight: '900', color: C.ink, lineHeight: 33 }} accessibilityRole="header">
              {(lang === 'es' ? brand.cover_title_es : brand.cover_title_en) || L('Tu familia, más cerca', 'Your family, closer')}
            </Text>
            <P>{(lang === 'es' ? brand.cover_sub_es : brand.cover_sub_en) || ''}</P>
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
