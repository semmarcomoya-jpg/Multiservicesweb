import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Btn, Circ, P } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { useInstall } from '@/lib/install';
import { C } from '@/lib/theme';

/** "Descarga la app": instala la app en el celular desde el navegador. */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const { L } = useLang();
  const { canPrompt, installed, isIOS, isWeb, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!isWeb || installed) return null;

  if (compact && canPrompt) return <Btn kind="ghost" icon="phone" title={L('Descargar la app', 'Download the app')} onPress={install} />;

  return (
    <View style={{ backgroundColor: C.blueSoft, borderRadius: 18, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Circ n="phone" tone="white" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', fontSize: 16, color: C.blueInk }}>{L('Descarga la app en tu celular', 'Get the app on your phone')}</Text>
          <P small style={{ color: C.blueInk }}>{L('Queda en tu pantalla de inicio, como cualquier app. Sin tienda de apps.', 'It sits on your home screen like any app. No app store needed.')}</P>
        </View>
      </View>
      {canPrompt ? (
        <Btn kind="blue" icon="phone" title={L('Descargar la app', 'Download the app')} onPress={install} />
      ) : (
        <>
          <Pressable accessibilityRole="button" onPress={() => setHelp((h) => !h)}>
            <Text style={{ fontWeight: '900', color: C.blue }}>{help ? L('Ocultar pasos', 'Hide steps') : L('¿Cómo la descargo?', 'How do I get it?')}</Text>
          </Pressable>
          {help ? (
            isIOS ? (
              <P small style={{ color: C.blueInk }}>
                {L('En iPhone, abre esta página en Safari, toca el botón Compartir (el cuadrito con flecha) y elige "Agregar a inicio".', 'On iPhone, open this page in Safari, tap Share (the square with an arrow) and choose "Add to Home Screen".')}
              </P>
            ) : (
              <P small style={{ color: C.blueInk }}>
                {L('En Android, abre esta página en Chrome, toca el menú (⋮) y elige "Instalar app" o "Agregar a pantalla principal".', 'On Android, open this page in Chrome, tap the menu (⋮) and choose "Install app" or "Add to Home screen".')}
              </P>
            )
          ) : null}
        </>
      )}
    </View>
  );
}
