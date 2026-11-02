/** Prender o apagar los avisos con la app cerrada en este equipo. */
import React, { useEffect, useState } from 'react';

import { Btn, Card, H2, Note, P } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { currentSub, disablePush, enablePush, isIosBrowser, pushSupported } from '@/lib/push';
import { errMsg } from '@/lib/supabase';

export function PushCard() {
  const { L } = useLang();
  const { session } = useAuth();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    currentSub().then((s) => setOn(!!s && Notification.permission === 'granted')).catch(() => setOn(false));
  }, []);
  if (!pushSupported()) {
    return (
      <Card>
        <H2>{L('Avisos en el celular', 'Phone notifications')}</H2>
        <P small muted>
          {isIosBrowser()
            ? L('En iPhone: toca Compartir → "Agregar a inicio", abre la app desde ese ícono y vuelve aquí para prender los avisos.', 'On iPhone: tap Share → "Add to Home Screen", open the app from that icon and come back here to turn on notifications.')
            : L('Este navegador no permite avisos. Prueba con Chrome o instala la app.', 'This browser does not support notifications. Try Chrome or install the app.')}
        </P>
      </Card>
    );
  }
  const toggle = async () => {
    setErr('');
    setBusy(true);
    try {
      if (on) await disablePush();
      else if (session) await enablePush(session.user.id);
      setOn(!on);
    } catch (e) {
      setErr(Notification.permission === 'denied' ? L('Los avisos están bloqueados. Actívalos en los ajustes del navegador para esta página.', 'Notifications are blocked. Allow them in your browser settings for this site.') : errMsg(e));
    }
    setBusy(false);
  };
  return (
    <Card>
      <H2>{L('Avisos en el celular', 'Phone notifications')}</H2>
      <P small muted>{L('Te avisamos cuando tu pedido avance o tu envío esté listo, aunque tengas la app cerrada.', 'We let you know when your order moves forward or your transfer is ready, even with the app closed.')}</P>
      {err ? <Note kind="red">{err}</Note> : null}
      <Btn icon="bell" kind={on ? 'ghost' : 'primary'} title={on ? L('Apagar avisos en este equipo', 'Turn off on this device') : L('Prender avisos', 'Turn on notifications')} onPress={toggle} loading={busy || on === null} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}
