import React from 'react';
import { Linking } from 'react-native';

import { BackBar, Btn, Card, H1, H2, Loading, P, Screen } from '@/components/ui';
import { useSettings } from '@/lib/data';
import { useLang } from '@/lib/i18n';

export default function Ayuda() {
  const { L, lang } = useLang();
  const { data: cfg } = useSettings();
  if (!cfg) return <Loading />;
  const wa = (cfg.help_wa || '').replace(/\D/g, '');
  return (
    <Screen wall="profile">
      <BackBar title={L('Ayuda y términos', 'Help & terms')} />
      <H1>{L('¿Necesitas ayuda?', 'Need help?')}</H1>
      <Card>
        <P>{L('Escríbenos y te atendemos en español o inglés.', 'Message us and we will help you in Spanish or English.')}</P>
        {wa ? <Btn icon="chat" title={L('Escribir por WhatsApp', 'Message on WhatsApp')} onPress={() => Linking.openURL(`https://wa.me/${wa}`)} /> : null}
        {cfg.help_mail ? <Btn kind="ghost" icon="doc" title={cfg.help_mail} onPress={() => Linking.openURL(`mailto:${cfg.help_mail}`)} /> : null}
        {!wa && !cfg.help_mail ? <P small muted>{L('Pregunta en tu tienda; con gusto te ayudamos.', 'Ask at your store; we are happy to help.')}</P> : null}
      </Card>
      <Card>
        <H2>{L('Términos y condiciones', 'Terms and conditions')}</H2>
        <P>{(lang === 'es' ? cfg.terms_es : cfg.terms_en) || cfg.terms_es || ''}</P>
      </Card>
    </Screen>
  );
}
