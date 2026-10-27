/**
 * Video de historia en la app instalada desde tienda (Android/iPhone nativo):
 * aún no hay reproductor nativo (haría falta expo-video). Igual que en Viva,
 * se muestra un aviso y se pasa a la siguiente a los 3 s. En la web (y en la
 * app descargada desde el navegador) los videos sí se reproducen.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useLang } from '@/lib/i18n';

export interface StoryVideoProps {
  uri: string;
  paused: boolean;
  onProgress: (fraction: number) => void;
  onEnd: () => void;
}

export function StoryVideo({ onEnd }: StoryVideoProps) {
  const { L } = useLang();
  useEffect(() => {
    const id = setTimeout(onEnd, 3000);
    return () => clearTimeout(id);
  }, [onEnd]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16 }}>{L('Este video se ve en la versión web de la app.', 'This video plays in the web version of the app.')}</Text>
    </View>
  );
}
