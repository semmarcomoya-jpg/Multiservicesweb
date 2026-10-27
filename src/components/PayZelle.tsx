/**
 * "Paga tu pedido" con Zelle, igual que en Viva:
 *  - A quién mandarlo, a nombre de quién, el monto exacto y la nota "Pedido A-1001",
 *    cada uno con su botón Copiar.
 *  - Queda "Pago por confirmar" hasta que la tienda toca "Pago recibido".
 *  - Extra de Castillo: el cliente puede subir la captura (opcional) para que lo confirmen más rápido.
 */
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { Icon } from '@/components/ui';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Order, Store } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

/** Teléfono de EE. UU. bonito: (732) 496-8863; el correo tal cual. */
export function prettyZelle(v: string) {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (!v.includes('@') && d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return v.trim();
}
const copyValue = (v: string) => (v.includes('@') ? v.trim() : v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') || v.trim());

export const zelleMemo = (folio: string, es: boolean) => (es ? `Pedido ${folio}` : `Order ${folio}`);

export function PayZelle({ order, store, userId, captura, onChanged }: { order: Order; store: Store | null | undefined; userId: string; captura: string | null; onChanged: () => void }) {
  const { L, lang } = useLang();
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (order.status !== 'verificar') return null;

  const copy = (key: string, v: string) => {
    void Clipboard.setStringAsync(v).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1800);
    });
  };
  const memo = zelleMemo(order.folio, lang === 'es');
  const row = (key: string, label: string, value: string, cv?: string) => (
    <View key={key} style={st.row}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={st.label}>{label}</Text>
        <Text style={st.value} selectable>{value}</Text>
      </View>
      {cv !== undefined ? (
        <Pressable accessibilityRole="button" accessibilityLabel={L('Copiar ', 'Copy ') + label} onPress={() => copy(key, cv)} hitSlop={8} style={st.copy}>
          <Icon n={copied === key ? 'check' : 'doc'} size={15} color={C.brown} sw={2.4} />
          <Text style={st.copyTxt}>{copied === key ? L('Copiado', 'Copied') : L('Copiar', 'Copy')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const upload = async () => {
    setErr('');
    const img = await pickImage();
    if (!img) return;
    setBusy(true);
    try {
      const path = await uploadImage('capturas', userId, img);
      const { error } = await supabase.rpc('attach_captura', { p_order: order.id, p_captura: path });
      if (error) throw error;
      onChanged();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <View style={st.card} testID="pagar-pedido">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon n="phone" size={22} color={C.brown} />
        <Text style={{ fontSize: 19, fontWeight: '900', color: C.ink }}>{L('Paga tu pedido con Zelle', 'Pay your order with Zelle')}</Text>
      </View>
      {store?.zelle_dato ? row('zelle', L('Enviar a', 'Send to'), prettyZelle(store.zelle_dato), copyValue(store.zelle_dato)) : null}
      {store?.zelle_nombre ? row('name', L('A nombre de', 'Name on Zelle'), store.zelle_nombre) : null}
      {row('amount', L('Monto exacto', 'Exact amount'), money(order.total), Number(order.total).toFixed(2))}
      {row('memo', L('Nota (memo)', 'Memo'), memo, memo)}
      <Text style={st.hint}>
        {L(
          'Abre la app de tu banco, entra a Zelle y manda el monto exacto con la nota. La tienda lo confirma en cuanto le llegue.',
          'Open your bank app, go to Zelle and send the exact amount with the memo. The store confirms it as soon as it arrives.',
        )}
      </Text>

      {captura ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: captura }} style={{ width: 54, height: 72, borderRadius: 8, backgroundColor: C.cream }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>{L('Ya subiste tu captura', 'Screenshot uploaded')}</Text>
            <Pressable onPress={upload} disabled={busy}>
              <Text style={{ color: C.blue, fontWeight: '800' }}>{busy ? L('Subiendo…', 'Uploading…') : L('Cambiar', 'Change')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={upload} disabled={busy} style={st.upload}>
          <Icon n="upload" size={20} color={C.brown} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>{busy ? L('Subiendo…', 'Uploading…') : L('¿Ya pagaste? Sube tu captura', 'Paid already? Upload your screenshot')}</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>{L('Opcional. Ayuda a que la tienda lo confirme más rápido.', 'Optional. Helps the store confirm it faster.')}</Text>
          </View>
        </Pressable>
      )}
      {err ? <Text style={{ color: C.red, fontWeight: '700' }}>{err}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon n="clock" size={16} color={C.muted} />
        <Text style={{ flex: 1, color: C.muted, fontSize: 12, fontWeight: '700' }}>
          {L('Pago por confirmar. Esta pantalla cambia sola cuando la tienda lo reciba.', 'Payment pending. This screen updates by itself when the store receives it.')}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 2, borderColor: C.brown, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.muted, fontSize: 12, fontWeight: '700' },
  value: { color: C.ink, fontSize: 17, fontWeight: '800' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.brown },
  copyTxt: { color: C.brown, fontSize: 12, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 13, lineHeight: 19 },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, borderRadius: R.md, padding: 12 },
});
