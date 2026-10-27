/** Menú que sube desde abajo (como el de los "⋮" en las apps). */
import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { C } from '@/lib/theme';

export interface SheetItem {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  sub?: string;
  onPress: () => void;
}

export function ActionSheet({ visible, title, items, onClose }: { visible: boolean; title?: string; items: SheetItem[]; onClose: () => void }) {
  const { L } = useLang();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel={L('Cerrar', 'Close')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,31,58,0.45)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 520, backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: 20 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line2, marginBottom: 8 }} />
          {title ? <Text style={{ marginHorizontal: 20, marginVertical: 8, fontWeight: '900', color: C.ink, fontSize: 16, lineHeight: 21, maxHeight: 42, overflow: 'hidden' }} numberOfLines={2}>{title}</Text> : null}
          {items.map((it) => (
            <Pressable
              key={it.key}
              accessibilityRole="button"
              onPress={it.onPress}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? C.tint : 'transparent' })}
            >
              {it.icon ? <Icon n={it.icon} size={20} color={it.danger ? C.red : C.ink} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: it.danger ? C.red : C.ink }}>{it.label}</Text>
                {it.sub ? <Text style={{ fontSize: 12, color: C.muted }}>{it.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={{ marginTop: 6, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center' }}>
            <Text style={{ fontWeight: '900', color: C.ink }}>{L('Cancelar', 'Cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
