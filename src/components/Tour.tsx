/** Guía de bienvenida (5 pasos), la primera vez que entras. */
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Btn, Icon } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

const KEY = 'castillo.tour.v1';
export const tourDone = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
};
export const resetTour = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
};

export function Tour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { L } = useLang();
  const [i, setI] = useState(0);
  const steps: [string, string, string][] = [
    ['send', L('Envía dinero a tu familia', 'Send money to your family'), L('Guarda a tus personas una vez y envía en pocos pasos. Ves cuánto reciben antes de pagar.', 'Save your people once and send in a few steps. See how much they get before paying.')],
    ['tool', L('Servicios sin salir de casa', 'Services from home'), L('Recargas, pagos, trámites y celulares. Tú eliges: digital, en tienda, sin bajar del carro o a domicilio.', 'Top-ups, bills, paperwork and phones. You choose: digital, in store, curbside or delivered.')],
    ['qr', L('Tu tarjeta suma puntos', 'Your card earns points'), L('Muéstrala en el mostrador o compra en la app: tus puntos se suman solos y los cambias por premios.', 'Show it at the counter or buy in the app: points add up and you trade them for rewards.')],
    ['wallet', L('Crédito y apartado', 'Credit and layaway'), L('Llévate tu celular en pagos semanales, quincenales o mensuales y paga tus abonos aquí o en tienda.', 'Take your phone home with weekly, biweekly or monthly payments and pay here or in store.')],
    ['chat', L('Boca a boca', 'Word of mouth'), L('Recomienda, califica a quien te atendió y entérate de lo que recomienda la comunidad.', 'Recommend, rate who helped you and see what the community recommends.')],
  ];
  const last = i === steps.length - 1;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* nada */
    }
    setI(0);
    onClose();
  };
  const s = steps[i];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,31,58,0.55)', alignItems: 'center', justifyContent: 'flex-end', padding: 16 }} accessibilityViewIsModal accessibilityLabel={L('Guía de bienvenida', 'Welcome guide')}>
        <View style={{ width: '100%', maxWidth: 440, backgroundColor: C.card, borderRadius: 26, padding: 24, alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon n={s[0]} size={40} color={C.brown} sw={1.8} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'center' }}>{s[1]}</Text>
          <Text style={{ fontSize: 16, color: C.softInk, textAlign: 'center', lineHeight: 22 }}>{s[2]}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
            {steps.map((_, k) => (
              <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? C.brown : C.line2 }} />
            ))}
          </View>
          <Btn title={last ? L('¡Empezar!', "Let's go!") : L('Siguiente', 'Next')} onPress={() => (last ? close() : setI(i + 1))} style={{ alignSelf: 'stretch' }} />
          {!last ? (
            <Pressable onPress={close} hitSlop={8}>
              <Text style={{ color: C.blue, fontWeight: '800' }}>{L('Saltar la guía', 'Skip the guide')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
