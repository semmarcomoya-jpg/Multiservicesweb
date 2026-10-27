import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { IcoBox, P, StatusChip } from '@/components/ui';
import { money, timeAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Order } from '@/lib/types';

export const orderIcon = (o: Order) =>
  ({ send: 'send', shop: 'bag', abono: 'wallet' } as Record<string, string>)[o.kind] || o.service_name?.icon || 'tool';

export function useOrderText() {
  const { L, nm, lang } = useLang();
  const title = (o: Order) => {
    if (o.kind === 'send') {
      const b = o.beneficiary;
      return b ? `${L('Envío a', 'Transfer to')} ${b.nombre} ${b.apellidos}`.trim() : L('Envío a México', 'Money to Mexico');
    }
    if (o.kind === 'service') return nm(o.service_name) + (o.service_name?.opcion ? ' · ' + nm(o.service_name.opcion) : '');
    if (o.kind === 'shop' && o.items?.length) return o.items[0].name + (o.items.length > 1 ? ` +${o.items.length - 1}` : '');
    if (o.kind === 'abono') return (o.inst ? L(`Abono ${o.inst}`, `Payment ${o.inst}`) : L('Enganche', 'Down payment')) + (o.folio_prov ? ' · ' + o.folio_prov : '') + (o.items?.length ? ' · ' + o.items[0].name : '');
    return o.kind;
  };
  const modeLabel = (m?: string | null) =>
    ({
      digital: L('Sin salir de casa', 'From home'),
      store: L('Recoger en tienda', 'Pick up in store'),
      curb: L('Sin bajar del carro', 'Curbside'),
      home: L('A domicilio', 'Home delivery'),
    } as Record<string, string>)[m || ''] || '';
  return { title, modeLabel, ago: (iso: string) => timeAgo(iso, lang) };
}

export function OrderRow({ o, onPress, showClient }: { o: Order; onPress: () => void; showClient?: boolean }) {
  const { L } = useLang();
  const { title, ago, modeLabel } = useOrderText();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 8, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IcoBox n={orderIcon(o)} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: '900', fontSize: 15, color: C.ink }} numberOfLines={1}>
            {title(o)}
          </Text>
          <P small muted>
            {o.folio} · {ago(o.created_at)}
            {o.entrega?.mode && o.entrega.mode !== 'digital' ? ' · ' + modeLabel(o.entrega.mode) + (o.entrega.time ? ' ' + o.entrega.time : '') : ''}
          </P>
        </View>
        <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{money(o.total)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {showClient ? (
          <P small muted>
            {o.cliente_nombre} · {o.attended_name ? L('Atiende ', 'By ') + o.attended_name : L('Sin asignar', 'Unassigned')}
            {o.entrega?.arrived && o.status === 'proceso' ? ' · ' + L('¡Ya llegó!', 'Arrived!') : ''}
          </P>
        ) : (
          <P small muted>{o.attended_name ? L('Te atiende ', 'Helped by ') + o.attended_name : ''}</P>
        )}
        <StatusChip status={o.status} />
      </View>
    </Pressable>
  );
}
