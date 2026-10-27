/** Estado del pedido como en Viva: tarjeta de color con barra de avance, hora estimada y "Avisarme". */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { Order } from '@/lib/types';

const KEY = (id: string) => 'castillo.avisar.' + id;
const canNotify = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
const getFlag = (id: string) => {
  try {
    return localStorage.getItem(KEY(id)) === '1';
  } catch {
    return false;
  }
};

async function notify(title: string, body: string) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png' });
    else new Notification(title, { body });
  } catch {
    /* sin permiso o sin soporte: no pasa nada */
  }
}

export function OrderStatusCard({ o }: { o: Order }) {
  const { L } = useLang();
  const mode = o.entrega?.mode;
  const [on, setOn] = useState(() => (canNotify() ? getFlag(o.id) && Notification.permission === 'granted' : false));
  const prev = useRef(o.status);

  const info = {
    verificar: {
      t: L('Pedido recibido', 'Order received'),
      s: L('La tienda ya tiene tu pedido. Falta que confirme tu pago.', 'The store has your order. Waiting for payment confirmation.'),
      n: 1,
    },
    proceso: {
      t: o.kind === 'send' ? L('Pago confirmado', 'Payment confirmed') : L('Preparando tu pedido', 'Preparing your order'),
      s: o.kind === 'send' ? L('Estamos mandando tu dinero.', 'We are sending your money.') : L('Ya confirmamos tu pago y estamos trabajando en tu pedido.', 'Payment confirmed, we are working on your order.'),
      n: 2,
    },
    completado: {
      t: L('¡Listo!', 'All set!'),
      s: o.kind === 'send' ? L('Tu dinero ya se envió. Aquí tienes tu comprobante.', 'Your money was sent. Here is your receipt.') : mode && mode !== 'digital' ? L('Pedido entregado. ¡Gracias!', 'Order delivered. Thank you!') : L('Tu servicio está hecho. Aquí tienes tu comprobante.', 'Your service is done. Here is your receipt.'),
      n: 3,
    },
    rechazado: {
      t: L('No se pudo completar', 'Could not be completed'),
      s: o.reject_reason || L('La tienda no pudo confirmar tu pago. Comunícate con la tienda.', "The store couldn't confirm your payment. Please contact the store."),
      n: 0,
    },
  }[o.status];

  // Cuando cambia el estado y pidió aviso, le avisamos en el teléfono
  useEffect(() => {
    if (prev.current !== o.status && canNotify() && getFlag(o.id) && Notification.permission === 'granted') {
      notify(`${L('Pedido', 'Order')} ${o.folio}: ${info.t}`, info.s);
    }
    prev.current = o.status;
  }, [o.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async () => {
    if (!canNotify()) return;
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p === 'granted') {
      try {
        localStorage.setItem(KEY(o.id), '1');
      } catch {
        /* nada */
      }
      setOn(true);
    }
  };

  const eta =
    o.status === 'completado' || o.status === 'rechazado'
      ? ''
      : o.entrega?.time
        ? (mode === 'home' ? L('Entrega estimada: ', 'Estimated delivery: ') : L('Estimado para las ', 'Estimated for ')) + o.entrega.time
        : o.kind === 'send'
          ? L('Normalmente llega minutos después de confirmar tu pago', 'Usually arrives minutes after payment is confirmed')
          : '';
  const bad = o.status === 'rechazado';

  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: bad ? C.red : C.brownDark, borderRadius: 24, padding: 22, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{info.t}</Text>
        <Text style={{ color: '#DCE7F6', fontSize: 16, lineHeight: 22 }}>{info.s}</Text>
        {!bad ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= info.n ? C.gold : 'rgba(255,255,255,0.22)' }} />
            ))}
          </View>
        ) : null}
        {o.attended_name ? (
          <Text style={{ color: '#fff', fontWeight: '700' }}>{(o.status === 'completado' ? L('Te atendió ', 'You were helped by ') : L('Te atiende ', 'Helping you: ')) + o.attended_name}</Text>
        ) : null}
        {eta ? <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 2 }}>{eta}</Text> : null}
      </View>

      {canNotify() && o.status !== 'completado' && !bad ? (
        <Pressable
          accessibilityRole="button"
          onPress={ask}
          disabled={on}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, borderRadius: 999, borderWidth: 2, borderColor: C.brownDark, backgroundColor: on ? C.blueSoft : 'transparent', paddingHorizontal: 16 }}
        >
          <Icon n={on ? 'check' : 'bell'} size={20} color={C.brownDark} />
          <Text style={{ fontWeight: '900', color: C.brownDark, fontSize: 15, textAlign: 'center', flexShrink: 1 }}>
            {on ? L('Te avisaremos en este teléfono', "We'll notify you on this phone") : L('Avisarme en este teléfono cuando esté listo', 'Notify me on this phone when ready')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
