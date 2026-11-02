import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { usePanelStore } from '@/components/panel';
import { QrCode } from '@/components/Qr';
import { PushCard } from '@/components/PushCard';
import { StoreForm } from '@/components/StoreForm';
import { Text } from '@/components/Text';
import { Btn, Card, Empty, H2, Loading, P, Pills, Row, Screen } from '@/components/ui';
import { getSound, playAlert, setSound, type AlertSound } from '@/lib/alert';
import { storeShort, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { storeLink } from '@/lib/hours';
import { C, R } from '@/lib/theme';

/** Imprime solo el cartel (no toda la pantalla). */
function printSign() {
  const id = 'castillo-print-qr';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = '@media print{body.print-qr *{visibility:hidden!important}body.print-qr #cartel-qr,body.print-qr #cartel-qr *{visibility:visible!important}body.print-qr #cartel-qr{position:fixed!important;top:24px;left:50%;transform:translateX(-50%) scale(1.4);transform-origin:top center}}';
    document.head.appendChild(s);
  }
  document.body.classList.add('print-qr');
  window.print();
  setTimeout(() => document.body.classList.remove('print-qr'), 500);
}

export default function MiTienda() {
  const { L } = useLang();
  const { data: stores, reload } = useStores();
  const st = usePanelStore(stores);
  const [snd, setSnd] = useState<AlertSound>(getSound());
  if (!stores) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada. Pide al administrador que la asigne.', 'This account has no store assigned. Ask the administrator.')}</Empty></Screen>;
  const link = storeLink(st.id);
  return (
    <Screen wide>
      <StoreForm key={st.id} store={st} onSaved={reload} />

      <Card>
        <H2>{L('Sonido del pedido nuevo', 'New order sound')}</H2>
        <P small muted>{L('Suena en este equipo cuando llega un pedido de la app. Se guarda en este equipo: elige uno en cada computadora o celular de la tienda.', 'Plays on this device when an app order arrives. Saved on this device: pick one on each store computer or phone.')}</P>
        <Row style={{ alignItems: 'flex-end' }}>
          <Pills
            options={[
              { v: 'caja' as const, label: L('Caja registradora', 'Cash register') },
              { v: 'campana' as const, label: L('Campana', 'Bell') },
              { v: 'timbre' as const, label: L('Timbre', 'Buzzer') },
              { v: 'sin' as const, label: L('Sin sonido', 'No sound') },
            ]}
            value={snd}
            onChange={(v) => { setSnd(v); setSound(v); playAlert(v); }}
          />
          <Btn small kind="ghost" icon="bell" title={L('Probar', 'Test')} onPress={() => playAlert(snd)} disabled={snd === 'sin'} />
        </Row>
        <P small muted>{L('Deja la pestaña de Pedidos abierta para escucharlo.', 'Keep the Orders tab open to hear it.')}</P>
      </Card>

      <PushCard />

      <Card>
        <H2>{L('Cartel con QR para el mostrador', 'Counter QR sign')}</H2>
        <P small muted>{L('Imprímelo y pégalo en la tienda. Al escanearlo, el cliente ve la ficha de esta sucursal con sus servicios, horario y reseñas.', 'Print it and put it up in the store. Scanning it opens this branch page with services, hours and reviews.')}</P>
        <View nativeID="cartel-qr" style={{ alignSelf: 'center', alignItems: 'center', gap: 10, padding: 22, borderRadius: R.lg, borderWidth: 3, borderColor: C.brown, backgroundColor: '#fff', maxWidth: 360 }}>
          <Text style={{ fontWeight: '900', fontSize: 22, color: C.strong, textAlign: 'center' }}>{L('¡Escanéame!', 'Scan me!')}</Text>
          <Text style={{ fontWeight: '700', color: C.ink, textAlign: 'center' }}>{L('Envíos, pagos, recargas y más desde tu celular', 'Transfers, payments, top-ups and more from your phone')}</Text>
          <QrCode value={link} size={220} />
          <Text style={{ fontWeight: '900', color: C.ink }}>{storeShort(st)}</Text>
          <Text style={{ fontSize: 12, color: C.muted }} selectable>{link}</Text>
        </View>
        {Platform.OS === 'web' ? (
          <Row style={{ justifyContent: 'center' }}>
            <Btn small icon="receipt" title={L('Imprimir cartel', 'Print sign')} onPress={printSign} />
          </Row>
        ) : null}
      </Card>
    </Screen>
  );
}
