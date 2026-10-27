import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Btn, Card, Empty, Field, Loading, matches, Note, P, Pills, Row, Screen, SearchBox } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { ID_TYPES } from '@/lib/idtypes';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { IdDocRow } from '@/lib/types';
import { signedUrl } from '@/lib/upload';

function IdPhoto({ path, label }: { path: string; label: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    signedUrl('identificaciones', path).then(setUri);
  }, [path]);
  return (
    <Pressable onPress={() => setBig(!big)} style={{ flex: 1, minWidth: 160, gap: 4 }}>
      <P small muted style={{ fontWeight: '800' }}>{label}</P>
      <View style={{ height: big ? 360 : 150, borderRadius: R.md, backgroundColor: C.tint, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
      </View>
    </Pressable>
  );
}

function age(d: string | null) {
  if (!d) return null;
  const b = new Date(d.slice(0, 10) + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export default function Identificaciones() {
  const { L, lang } = useLang();
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<IdDocRow[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    supabase.rpc('pending_ids', { p_all: all }).then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setRows((data as IdDocRow[]) ?? []);
    });
  }, [all]);
  useFocusEffect(load);
  useEffect(load, [load]);

  if (!rows) return <Loading />;
  const tipo = (t: string) => {
    const x = ID_TYPES.find((i) => i[0] === t);
    return x ? (lang === 'es' ? x[1] : x[2]) : t;
  };
  const review = async (r: IdDocRow, ok: boolean) => {
    setBusy(r.user_id + ok);
    setErr('');
    setMsg('');
    const { error } = await supabase.rpc('review_id', { p_user: r.user_id, p_ok: ok, p_note: note[r.user_id] || '' });
    setBusy('');
    if (error) return setErr(errMsg(error));
    setMsg(ok ? L(`Identificación de ${r.nombre} verificada`, `${r.nombre}'s ID verified`) : L(`Le avisamos a ${r.nombre} que suba otra identificación`, `We asked ${r.nombre} to upload another ID`));
    load();
  };
  const list = rows.filter((r) => matches(q, r.nombre, r.member_code, r.tipo));
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const stColor = (s: string) => (s === 'verificada' ? '#1E5B35' : s === 'rechazada' ? C.red : '#7A4A00');
  const stName = (s: string) => ({ verificada: L('Verificada', 'Verified'), rechazada: L('Rechazada', 'Rejected'), pendiente: L('Por revisar', 'To review') })[s] || s;

  return (
    <Screen wide>
      <Note kind="blue" icon="id">
        {L('Revisa que el nombre y la fecha de nacimiento coincidan con la cuenta y que la foto se lea bien. Toca una foto para verla grande. Solo verificamos identidad; nunca preguntes por estatus migratorio.', "Check that the name and date of birth match the account and the photo is legible. Tap a photo to enlarge it. We only verify identity; never ask about immigration status.")}
      </Note>
      <Pills options={[{ v: 'p', label: L('Por revisar', 'To review') }, { v: 'a', label: L('Historial', 'History') }]} value={all ? 'a' : 'p'} onChange={(v) => setAll(v === 'a')} />
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Buscar cliente', 'Search customer')} count={list.length} />
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      {list.length ? (
        list.map((r) => {
          const a = age(r.fecha_nac);
          return (
            <Card key={r.user_id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{r.nombre}</Text>
                  <P small muted>
                    {r.member_code} · {tipo(r.tipo)}
                    {r.fecha_nac ? ' · ' + L('nac. ', 'born ') + fmt(r.fecha_nac) + (a !== null ? ` (${a})` : '') : ' · ' + L('sin fecha de nacimiento en su perfil', 'no birth date on profile')}
                  </P>
                  <P small muted>{L('Enviada ', 'Sent ') + fmt(r.submitted_at)}{r.reviewed_by ? ' · ' + L('revisó ', 'reviewed by ') + r.reviewed_by : ''}</P>
                </View>
                <Text style={{ fontWeight: '900', color: stColor(r.id_status) }}>{stName(r.id_status)}</Text>
              </View>
              <Row style={{ flexWrap: 'wrap' }}>
                <IdPhoto path={r.front_path} label={L('Frente', 'Front')} />
                <IdPhoto path={r.back_path} label={L('Reverso', 'Back')} />
              </Row>
              {r.note ? <P small>{L('Nota: ', 'Note: ') + r.note}</P> : null}
              {r.id_status === 'pendiente' ? (
                <>
                  <Field label={L('Nota para el cliente (si la rechazas)', 'Note for the customer (if rejected)')} value={note[r.user_id] || ''} onChangeText={(v) => setNote({ ...note, [r.user_id]: v })} placeholder={L('Ej. la foto salió borrosa', 'E.g. the photo is blurry')} />
                  <Row>
                    <Btn small icon="check" title={L('Verificar', 'Verify')} loading={busy === r.user_id + 'true'} onPress={() => review(r, true)} />
                    <Btn small kind="danger" title={L('Rechazar', 'Reject')} loading={busy === r.user_id + 'false'} onPress={() => review(r, false)} />
                  </Row>
                </>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Empty>{all ? L('Aún no hay identificaciones.', 'No IDs yet.') : L('No hay identificaciones por revisar.', 'No IDs to review.')}</Empty>
      )}
    </Screen>
  );
}
