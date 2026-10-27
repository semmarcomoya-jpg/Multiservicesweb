import React from 'react';
import { View } from 'react-native';

import { QrCode } from '@/components/Qr';
import { Text } from '@/components/Text';
import { BackBar, BrandMark, Loading, Note, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { useMyPoints } from '@/lib/points';
import { C } from '@/lib/theme';

export default function Tarjeta() {
  const { L } = useLang();
  const { session, profile } = useAuth();
  const { brand } = useBranding();
  const { data: stores } = useStores();
  const { balance } = useMyPoints(session?.user.id);
  if (!profile) return <Loading />;
  const fav = (stores || []).find((s) => s.id === profile.store_id);
  const code = profile.member_code || '';
  return (
    <Screen wall="pts">
      <BackBar title={L('Mi tarjeta', 'My card')} />
      <View style={{ alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 26, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', paddingBottom: 22, gap: 12 }}>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brownDark, paddingHorizontal: 18, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BrandMark size={28} />
            <Text style={{ color: '#fff', fontWeight: '900' }}>{brand.corto || brand.nombre}</Text>
          </View>
          {fav ? <Text style={{ color: C.goldSoft, fontWeight: '900' }}>{balance(fav.id)} pts</Text> : null}
        </View>
        <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 16 }}>
          <QrCode value={code} size={220} />
        </View>
        <Text selectable style={{ fontSize: 26, fontWeight: '900', letterSpacing: 2, color: C.ink }}>{code}</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{`${profile.nombre} ${profile.apellidos}`.trim()}</Text>
      </View>
      <Note kind="gold" icon="store">{L('Muéstrala en el mostrador cuando pagues cualquier servicio o compra. El empleado la escanea y tus puntos se suman solos.', 'Show it at the counter whenever you pay for a service or purchase. Staff scans it and your points add up automatically.')}</Note>
      <Note kind="blue" icon="wallet">{L('También sirve para pagar tus abonos de crédito o apartado en la tienda.', 'You can also use it to make your credit or layaway payments in store.')}</Note>
      <Note kind="blue" icon="camera">{L('Tip: toma una captura de pantalla para tenerla aunque no tengas internet.', 'Tip: take a screenshot so you have it even without internet.')}</Note>
    </Screen>
  );
}
