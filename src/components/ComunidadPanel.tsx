/** Boca a boca para la tienda y el administrador: publicar como tienda, responder y ocultar (con motivo). */
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PostCard, useHideReasons, usePostKinds } from '@/components/PostCard';
import { Btn, Card, Empty, Field, H2, Loading, Note, Pills, Row, SearchBox, matches } from '@/components/ui';
import { storeShort } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import type { Post, PostKind, Store } from '@/lib/types';

export function ComunidadPanel({ stores, storeId }: { stores: Store[]; storeId?: string | null }) {
  const { L } = useLang();
  const K = usePostKinds();
  const reasons = useHideReasons();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [st, setSt] = useState<string>(storeId || 'all');
  const [kind, setKind] = useState<'all' | PostKind | 'hidden'>('all');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [pubStore, setPubStore] = useState<string | null>(storeId || stores[0]?.id || null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, Post['hide_reason']>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    let qy = supabase.from('posts').select('*, post_replies(*)').order('created_at', { ascending: false }).limit(500);
    if (storeId) qy = qy.eq('store_id', storeId);
    qy.then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setPosts((data as Post[]) ?? []);
    });
  }, [storeId]);
  useFocusEffect(load);

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, after?: () => void) => {
    setBusy(key);
    setErr('');
    const { error } = await fn();
    setBusy('');
    if (error) return setErr(errMsg(error));
    after?.();
    load();
  };
  const name = (id: string) => {
    const s = stores.find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };

  if (!posts) return <Loading />;
  const list = posts.filter(
    (p) =>
      (st === 'all' || p.store_id === st) &&
      (kind === 'all' || (kind === 'hidden' ? p.hidden : p.kind === kind)) &&
      matches(q, p.text, p.author_name, p.ref_label, name(p.store_id)),
  );
  const nHidden = posts.filter((p) => p.hidden && (st === 'all' || p.store_id === st)).length;

  return (
    <>
      <Note kind="blue" icon="shield">
        {L(
          'Responde siempre las críticas: muestra que escuchas. Oculta solo publicaciones ofensivas, spam o con datos personales. Ocultar reseñas solo por ser negativas puede violar las reglas de la FTC sobre reseñas.',
          'Always reply to criticism: it shows you listen. Hide only offensive posts, spam or personal data. Hiding reviews just because they are negative may violate FTC review rules.',
        )}
      </Note>

      <Card>
        <H2>{L('Publicar como tienda', 'Post as the store')}</H2>
        {!storeId ? <Pills label={L('¿De qué tienda?', 'Which store?')} options={stores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store', img: s.fotos?.[0] || null }))} value={pubStore} onChange={setPubStore} /> : null}
        <Field label={L('Aviso, novedad o promoción', 'Notice, news or deal')} value={draft} onChangeText={setDraft} multiline maxLength={600} />
        <Btn
          title={L('Publicar', 'Post')}
          icon="chat"
          disabled={!draft.trim() || !pubStore}
          loading={busy === 'pub'}
          onPress={() => run('pub', () => supabase.rpc('create_post', { p_store: pubStore, p_kind: 'store', p_stars: 0, p_text: draft.trim(), p_ref_type: null, p_ref_id: null, p_ref_label: '' }), () => setDraft(''))}
          style={{ alignSelf: 'flex-start' }}
        />
      </Card>

      {!storeId && stores.length > 1 ? (
        <Pills options={[{ v: 'all', label: L('Todas las tiendas', 'All stores') }, ...stores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store' }))]} value={st} onChange={setSt} />
      ) : null}
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca en las publicaciones', 'Search posts')} count={q ? list.length : undefined} />
      <Pills
        options={[
          { v: 'all' as const, label: L('Todo', 'All') },
          ...(Object.keys(K) as PostKind[]).map((k) => ({ v: k, label: K[k].label })),
          { v: 'hidden' as const, label: L(`Ocultas · ${nHidden}`, `Hidden · ${nHidden}`) },
        ]}
        value={kind}
        onChange={setKind}
      />
      {err ? <Note kind="red">{err}</Note> : null}
      {list.length === 0 ? <Empty>{L('No hay publicaciones con estos filtros.', 'No posts with these filters.')}</Empty> : null}
      {list.map((p) => (
        <PostCard
          key={p.id}
          p={p}
          storeName={name(p.store_id)}
          footer={
            <View style={{ gap: 8, marginTop: 4 }}>
              {p.kind !== 'store' ? (
                <Row style={{ alignItems: 'flex-end' }}>
                  <Field label={L('Responder públicamente', 'Reply publicly')} value={reply[p.id] || ''} onChangeText={(v) => setReply((r) => ({ ...r, [p.id]: v }))} maxLength={500} />
                  <Btn
                    title={L('Responder', 'Reply')}
                    disabled={!(reply[p.id] || '').trim()}
                    loading={busy === 'r' + p.id}
                    onPress={() => run('r' + p.id, () => supabase.rpc('reply_post', { p_post: p.id, p_text: (reply[p.id] || '').trim() }), () => setReply((r) => ({ ...r, [p.id]: '' })))}
                  />
                </Row>
              ) : null}
              {p.hidden ? (
                <Btn small kind="ghost" title={L('Mostrar de nuevo', 'Show again')} loading={busy === 'h' + p.id} onPress={() => run('h' + p.id, () => supabase.rpc('moderate_post', { p_post: p.id, p_hide: false, p_reason: '' }))} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <View style={{ gap: 6 }}>
                  <Pills label={L('Motivo para ocultar', 'Reason to hide')} options={reasons} value={reason[p.id] || null} onChange={(v) => setReason((r) => ({ ...r, [p.id]: v }))} />
                  <Btn small kind="danger" title={L('Ocultar', 'Hide')} disabled={!reason[p.id]} loading={busy === 'h' + p.id} onPress={() => run('h' + p.id, () => supabase.rpc('moderate_post', { p_post: p.id, p_hide: true, p_reason: reason[p.id] }))} style={{ alignSelf: 'flex-start' }} />
                </View>
              )}
            </View>
          }
        />
      ))}
    </>
  );
}
