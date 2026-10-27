import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';

import { usePostKinds } from '@/components/PostCard';
import { StarPicker } from '@/components/Stars';
import { BackBar, Btn, Card, Field, H1, Label, Loading, Note, P, Pills, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, pickOpen, prodName, storeShort, useProducts, useServices, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import type { PostKind } from '@/lib/types';

export default function NuevaPublicacion() {
  const { L, nm } = useLang();
  const { session, profile } = useAuth();
  const { data: stores } = useStores();
  const K = usePostKinds();
  const commStores = (stores || []).filter((s) => s.activo && modOn(s, 'comm'));
  const [kind, setKind] = useState<PostKind>('reco');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sid = storeId || pickOpen(commStores, profile?.store_id);
  const { data: products } = useProducts(sid);
  const { data: services } = useServices();

  if (!session) return <Redirect href="/entrar" />;
  if (!stores) return <Loading />;
  const st = commStores.find((s) => s.id === sid);
  const sensitive = /\d[\d\s().-]{7,}\d/.test(text) || /\S+@\S+\.\S+/.test(text);
  const problem = !text.trim()
    ? L('Escribe tu publicación', 'Write your post')
    : sensitive
      ? L('Por tu seguridad, quita números de cuenta, teléfonos o correos.', 'For your safety, remove account numbers, phone numbers or emails.')
      : kind === 'reco' && !stars
        ? L('Elige cuántas estrellas', 'Choose a star rating')
        : '';
  const refOpts = [
    ...(products || []).filter((p) => p.activo).map((p) => ({ v: 'product:' + p.id, label: prodName(p) })),
    ...(services || []).filter((sv) => sv.activo && !(st?.svc_off || []).includes(sv.id)).map((sv) => ({ v: 'service:' + sv.id, label: nm(sv) })),
  ];

  const publish = async () => {
    setTried(true);
    if (problem || !sid) return;
    setBusy(true);
    setErr('');
    const [rt, rid] = ref ? ref.split(':') : [null, null];
    const { error } = await supabase.rpc('create_post', {
      p_store: sid,
      p_kind: kind,
      p_stars: kind === 'reco' ? stars : 0,
      p_text: text.trim(),
      p_ref_type: rt,
      p_ref_id: rid,
      p_ref_label: refOpts.find((x) => x.v === ref)?.label || '',
    });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    router.replace('/comunidad');
  };

  return (
    <Screen wall="community">
      <BackBar title={L('Compartir', 'Share')} />
      <H1>{L('Comparte tu experiencia', 'Share your experience')}</H1>
      <Card>
        <Pills label={L('¿Qué quieres compartir?', 'What do you want to share?')} options={(['reco', 'prod', 'promo', 'sug'] as PostKind[]).map((k) => ({ v: k, label: K[k].label }))} value={kind} onChange={setKind} />
        <Pills label={L('¿De qué tienda?', 'Which store?')} options={commStores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store', img: s.fotos?.[0] || null }))} value={sid} onChange={(v) => { setStoreId(v); setRef(''); }} />
        {kind === 'reco' ? (
          <>
            <Label>{L('¿Cómo te fue?', 'How was it?')}</Label>
            <StarPicker value={stars} onChange={setStars} />
          </>
        ) : null}
        <Field
          label={{ reco: L('Cuéntanos tu experiencia', 'Tell us about it'), prod: L('¿Qué producto recomiendas y por qué?', 'Which product and why?'), promo: L('¿Qué promoción encontraste?', 'What deal did you find?'), sug: L('¿Qué le sugieres a la tienda?', 'What do you suggest?'), store: '' }[kind]}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={600}
          error={tried ? problem : ''}
        />
        {refOpts.length ? (
          <Pills label={L('Relacionado con (opcional)', 'Related to (optional)')} options={[{ v: '', label: L('Nada en particular', 'Nothing specific') }, ...refOpts]} value={ref} onChange={setRef} />
        ) : null}
        <P small muted>{L('Se publica al momento con tu nombre y la inicial de tu apellido. La tienda puede responderte.', 'It is posted right away with your first name and last initial. The store may reply.')}</P>
        {err ? <Note kind="red">{err}</Note> : null}
        <Btn title={L('Publicar', 'Post')} onPress={publish} loading={busy} icon="chat" />
      </Card>
    </Screen>
  );
}
