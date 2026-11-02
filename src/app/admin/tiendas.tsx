import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';

import { OpenSwitch } from '@/components/panel';
import { StoreForm } from '@/components/StoreForm';
import { Text } from '@/components/Text';
import { Btn, Loading, Note, P, Row, Screen } from '@/components/ui';
import { doodleUrl } from '@/components/scenes';
import { useStores } from '@/lib/data';
import { fmtTime, hoursOf, openState, storeLink } from '@/lib/hours';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function AdminTiendas() {
  const { L, lang } = useLang();
  const { data: stores, reload } = useStores();
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  if (!stores) return <Loading />;
  const st = sel ? stores.find((x) => x.id === sel) : null;

  const add = async () => {
    setErr('');
    const { data, error } = await supabase
      .from('stores')
      .insert({ nombre: L('Castillo · Sucursal nueva', 'Castillo · New branch'), activo: false, orden: stores.length + 1 })
      .select('id')
      .single();
    if (error) setErr(errMsg(error));
    else {
      await reload();
      setSel(data.id);
    }
  };

  // Editando una sucursal
  if (st)
    return (
      <Screen wide>
        <Row style={{ justifyContent: 'space-between' }}>
          <Btn small kind="ghost" icon="back" title={L('Todas las sucursales', 'All branches')} onPress={() => setSel(null)} />
          <Btn small kind="ghost" icon="eye" title={L('Ver como cliente', 'View as customer')} onPress={() => router.push(`/sucursal/${st.id}`)} />
        </Row>
        <OpenSwitch store={st} onChanged={reload} />
        <StoreForm key={st.id} store={st} admin onSaved={reload} />
      </Screen>
    );

  const day = new Date().getDay();
  return (
    <Screen wide>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{L('Sucursales', 'Branches')}</Text>
        <Btn small icon="plus" title={L('Nueva sucursal', 'New branch')} onPress={add} />
      </Row>
      {err ? <Note kind="red">{err}</Note> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stores.map((x) => {
          const os = openState(x);
          const h = hoursOf(x)[day];
          const link = storeLink(x.id);
          return (
            <View key={x.id} style={{ flexGrow: 1, flexBasis: 280, maxWidth: 420, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden', opacity: x.activo ? 1 : 0.7 }}>
              <View style={{ height: 86, backgroundColor: '#0B2E5E', ...(Platform.OS === 'web' ? ({ backgroundImage: `${doodleUrl('#62BDF6', 0.14)}, linear-gradient(160deg, #0B2E5E, #1656A8)`, backgroundSize: '160px, cover' } as object) : {}) }}>
                {x.fotos?.[0] ? <Image source={{ uri: x.fotos[0] }} style={{ width: '100%', height: 86, opacity: 0.85 }} resizeMode="cover" /> : null}
              </View>
              <View style={{ padding: 12, gap: 4 }}>
                <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{x.nombre}{x.activo ? '' : L(' (oculta)', ' (hidden)')}</Text>
                <P small muted>{[x.ciudad, h?.on ? L(`hoy ${fmtTime(h.a, lang)} – ${fmtTime(h.c, lang)}`, `today ${fmtTime(h.a, lang)} – ${fmtTime(h.c, lang)}`) : L('cerrada hoy', 'closed today')].filter(Boolean).join(' · ')}</P>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: os.open ? '#1E7A4A' : '#B23A2A' }}>{os.label[lang]}</Text>
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(link)}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.brown }} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
                </Pressable>
                <Row gap={8} style={{ marginTop: 4 }}>
                  <Btn small kind="ghost" icon="edit" title={L('Editar', 'Edit')} onPress={() => setSel(x.id)} />
                  <Btn small kind="ghost" icon="eye" title={L('Ver como cliente', 'View as customer')} onPress={() => router.push(`/sucursal/${x.id}`)} />
                </Row>
              </View>
            </View>
          );
        })}
      </View>
      <Note kind="blue">{L('Para que una tienda entre a su panel, crea su cuenta en "Cuentas" con el tipo "Personal de tienda".', 'For a store to use its panel, create its account in "Accounts" with type "Store staff".')}</Note>
    </Screen>
  );
}
