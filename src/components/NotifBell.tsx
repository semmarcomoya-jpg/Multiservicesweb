/** Campanita con el número de avisos sin leer. */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useNotifs } from '@/lib/notifs';
import { C } from '@/lib/theme';

export function NotifBell({ glass = false }: { glass?: boolean }) {
  const { L } = useLang();
  const { session } = useAuth();
  const { unread } = useNotifs(session?.user.id);
  if (!session) return null;
  const go = () => {
    // Dentro del teléfono del panel, los avisos se abren en la ventana completa
    if (typeof window !== 'undefined' && window.self !== window.top) {
      const base = window.location.pathname.replace(/\/inicio.*$/, '');
      window.top!.location.href = window.location.origin + base + '/avisos';
    } else router.push('/avisos');
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? L(`Avisos: ${unread} sin leer`, `Notifications: ${unread} unread`) : L('Avisos', 'Notifications')}
      onPress={go}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: glass ? 'rgba(255,255,255,0.85)' : C.card,
        borderWidth: glass ? 0 : 1,
        borderColor: C.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon n="bell" size={21} color={C.ink} />
      {unread ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: '#fff' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
