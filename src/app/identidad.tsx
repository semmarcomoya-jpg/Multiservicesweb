import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { BackBar, Btn, Card, H1, IcoBox, Note, P, Pills, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { ID_TYPES } from '@/lib/idtypes';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import { pickImage, uploadImage, type Picked } from '@/lib/upload';

export default function Identidad() {
  const { L, lang } = useLang();
  const { session, profile, refreshProfile } = useAuth();
  const { data: cfg } = useSettings();
  const [tipo, setTipo] = useState<string | null>(null);
  const [front, setFront] = useState<Picked | null>(null);
  const [back, setBack] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [retry, setRetry] = useState(false);
  useEffect(() => {
    void refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!profile || !cfg || !session) return null;
  const st = profile.id_status;
  const okTypes = ID_TYPES.filter(([k]) => (cfg.id_types || {})[k] !== false);
  const send = async () => {
    if (!tipo || !front || !back) return;
    setBusy(true);
    setErr('');
    try {
      const f = await uploadImage('identificaciones', session.user.id, front);
      const b = await uploadImage('identificaciones', session.user.id, back);
      const { error } = await supabase.rpc('submit_id', { p_tipo: tipo, p_front: f, p_back: b });
      if (error) throw error;
      await refreshProfile();
      setRetry(false);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };
  const Upload = ({ img, set, label }: { img: Picked | null; set: (p: Picked) => void; label: string }) => (
    <Pressable accessibilityRole="button" onPress={async () => { const p = await pickImage(); if (p) set(p); }}
      style={{ flex: 1, minHeight: 130, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, overflow: 'hidden', backgroundColor: C.card }}>
      {img ? <Image source={{ uri: img.uri }} style={{ width: '100%', height: 90, borderRadius: 10 }} resizeMode="cover" /> : <IcoBox n="camera" size={44} />}
      <Text style={{ fontWeight: '800', color: C.ink, textAlign: 'center' }}>{img ? label + ' ✓' : L('Subir ', 'Upload ') + label.toLowerCase()}</Text>
    </Pressable>
  );
  const showForm = st === 'ninguna' || st === 'rechazada' || retry;
  return (
    <Screen wall="profile">
      <BackBar title={L('Verifica tu identidad', 'Verify your identity')} />
      <H1>{L('Verifica tu identidad', 'Verify your identity')}</H1>
      <P muted>{L('Para enviar montos más altos necesitamos ver una identificación. Nunca te preguntamos tu estatus migratorio.', 'To send higher amounts we need to see an ID. We never ask about your immigration status.')}</P>
      <Card style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
        {[
          [L('Nivel 1 · sin identificación', 'Level 1 · no ID'), L('Hasta ', 'Up to ') + money(Number(cfg.limit_l1))],
          [L('Nivel 2 · identificación verificada', 'Level 2 · verified ID'), L('Hasta ', 'Up to ') + money(Number(cfg.limit_l2))],
          [L('Montos mayores', 'Larger amounts'), L('En tienda, con tu ID en mano', 'In store, with your ID')],
        ].map(([a, b], i) => (
          <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, padding: 14, backgroundColor: i === (st === 'verificada' ? 1 : 0) ? C.blueSoft : C.card, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Text style={{ fontWeight: '800', color: C.ink, flex: 1 }}>{a}</Text>
            <Text style={{ color: C.softInk }}>{b}</Text>
          </View>
        ))}
      </Card>
      {st === 'pendiente' && !retry ? (
        <Note kind="gold" icon="clock">{L(`Tu identificación está en revisión. Te avisaremos al aprobarla. Mientras tanto puedes enviar hasta ${money(Number(cfg.limit_l1))}.`, `Your ID is being reviewed. We will let you know. Meanwhile you can send up to ${money(Number(cfg.limit_l1))}.`)}</Note>
      ) : null}
      {st === 'verificada' && !retry ? (
        <Note kind="blue" icon="check">{L(`¡Identificación verificada! Ya puedes enviar hasta ${money(Number(cfg.limit_l2))} por envío.`, `ID verified! You can now send up to ${money(Number(cfg.limit_l2))} per transfer.`)}</Note>
      ) : null}
      {st === 'rechazada' ? <Note kind="red">{L('No pudimos verificar tu identificación. Sube fotos más claras o pasa a tu tienda.', "We couldn't verify your ID. Upload clearer photos or visit your store.")}</Note> : null}
      {showForm ? (
        <Card>
          <Pills label={L('Tipo de identificación', 'ID type')} options={okTypes.map(([k, es, en]) => ({ v: k, label: lang === 'es' ? es : en }))} value={tipo} onChange={setTipo} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Upload img={front} set={setFront} label={L('Frente', 'Front')} />
            <Upload img={back} set={setBack} label={L('Reverso', 'Back')} />
          </View>
          <P small muted>{L('Que se lean bien tu nombre, tu foto y la fecha. Solo la ve tu tienda.', 'Make sure your name, photo and dates are readable. Only your store sees it.')}</P>
          {err ? <Note kind="red">{err}</Note> : null}
          <Btn title={L('Enviar para revisión', 'Send for review')} icon="shield" disabled={!tipo || !front || !back} loading={busy} onPress={send} />
        </Card>
      ) : (
        <Btn kind="ghost" title={L('Subir otra identificación', 'Upload another ID')} onPress={() => setRetry(true)} />
      )}
    </Screen>
  );
}
