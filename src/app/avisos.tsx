import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { BackBar, Btn, Empty, H1, Icon, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { loadNotifs, markAllRead, markRead, useNotifs } from '@/lib/notifs';
import { C, R } from '@/lib/theme';

const ICON: Record<string, string> = { reply: 'chat', like: 'heart', hidden: 'lock', order: 'receipt', new_order: 'receipt', report: 'flag' };

export default function Avisos() {
  const { L, lang } = useLang();
  const { session } = useAuth();
  const { items, unread } = useNotifs(session?.user.id);
  useFocusEffect(
    useCallback(() => {
      void loadNotifs();
    }, []),
  );
  return (
    <Screen>
      <BackBar title={L('Avisos', 'Notifications')} />
      <H1>{L('Avisos', 'Notifications')}</H1>
      {unread ? <Btn small kind="ghost" icon="check" title={L('Marcar todo como leído', 'Mark all as read')} onPress={markAllRead} style={{ alignSelf: 'flex-start' }} /> : null}
      {items.length === 0 ? <Empty>{L('No tienes avisos todavía. Aquí te avisamos cuando te respondan o cambie tu pedido.', 'No notifications yet. We will tell you here when someone replies or your order changes.')}</Empty> : null}
      {items.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          onPress={() => {
            void markRead(n.id);
            if (n.link) router.push(n.link as never);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: R.lg, backgroundColor: n.read_at ? C.card : C.blueSoft, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: n.read_at ? C.tint : C.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon n={ICON[n.kind] || 'bell'} size={18} color={n.kind === 'like' ? C.red : C.brown} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: n.read_at ? '700' : '900', color: C.ink }}>{n.title}</Text>
            {n.body ? <Text style={{ color: C.softInk }} numberOfLines={3}>{n.body}</Text> : null}
            <Text style={{ fontSize: 12, color: C.muted }}>{timeAgo(n.created_at, lang)}</Text>
          </View>
          {!n.read_at ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue, marginTop: 6 }} /> : null}
        </Pressable>
      ))}
    </Screen>
  );
}
