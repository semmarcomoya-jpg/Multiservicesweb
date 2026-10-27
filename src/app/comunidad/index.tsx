import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ActionSheet, type SheetItem } from '@/components/ActionSheet';
import { PostCard, useHideReasons, usePostKinds } from '@/components/PostCard';
import { Stars } from '@/components/Stars';
import { Text, TextInput } from '@/components/Text';
import { BackBar, Btn, Card, Empty, H1, Loading, Note, P, Pills, Row, Screen, SearchBox, matches } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, storeShort, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Post, PostKind, PostReply } from '@/lib/types';

export default function Comunidad() {
  const { L } = useLang();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ post?: string }>();
  const { data: stores } = useStores();
  const K = usePostKinds();
  const reasons = useHideReasons();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'all' | PostKind>('all');
  const [store, setStore] = useState('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<string | null>(null); // publicación con la caja de comentario abierta
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; items: SheetItem[] } | null>(null);

  const load = useCallback(() => {
    supabase
      .from('posts')
      .select('*, post_replies(*)')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setErr(errMsg(error));
        // Lo oculto solo lo ve su autor (con aviso); a los demás no les llega
        setPosts(((data as Post[]) ?? []).filter((p) => !p.hidden || p.user_id === session?.user.id));
      });
    if (session) supabase.from('post_likes').select('post_id').then(({ data }) => setLiked(new Set((data || []).map((x: { post_id: string }) => x.post_id))));
  }, [session]);
  useFocusEffect(load);

  const commStores = (stores || []).filter((s) => s.activo && modOn(s, 'comm'));
  const name = (id: string | null) => {
    if (!id) return L('Todas las tiendas', 'All stores');
    const s = (stores || []).find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };
  const mine = (p: { user_id: string | null }) => !!session && p.user_id === session.user.id;
  const needLogin = () => {
    if (session) return false;
    router.push('/entrar');
    return true;
  };

  const like = async (p: Post) => {
    if (needLogin()) return;
    const on = liked.has(p.id);
    setLiked((s) => {
      const n = new Set(s);
      if (on) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    const { data } = await supabase.rpc('toggle_like', { p_post: p.id });
    if (typeof data === 'number') setPosts((l) => (l || []).map((x) => (x.id === p.id ? { ...x, likes: data } : x)));
  };

  const comment = async (p: Post) => {
    if (needLogin() || !draft.trim()) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('comment_post', { p_post: p.id, p_text: draft.trim() });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setDraft('');
    load();
  };

  const act = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setSheet(null);
    setErr('');
    const { error } = await fn();
    if (error) return setErr(errMsg(error));
    setMsg(ok);
    load();
  };

  const postMenu = (p: Post) => {
    if (mine(p)) {
      setSheet({
        title: L('Tu publicación', 'Your post'),
        items: [{ key: 'del', label: L('Borrar mi publicación', 'Delete my post'), icon: 'x', danger: true, onPress: () => act(() => supabase.rpc('delete_my_post', { p_post: p.id }), L('Borramos tu publicación.', 'Your post was deleted.')) }],
      });
      return;
    }
    if (needLogin()) return;
    setSheet({
      title: L('¿Por qué la reportas?', 'Why are you reporting it?'),
      items: reasons.map((r) => ({
        key: r.v,
        label: r.label,
        icon: 'flag',
        onPress: () => act(() => supabase.rpc('report_post', { p_post: p.id, p_reason: r.v }), L('Gracias. La tienda la va a revisar.', 'Thanks. The store will review it.')),
      })),
    });
  };
  const replyMenu = (r: PostReply) =>
    setSheet({
      title: L('Tu comentario', 'Your comment'),
      items: [{ key: 'del', label: L('Borrar mi comentario', 'Delete my comment'), icon: 'x', danger: true, onPress: () => act(() => supabase.rpc('delete_my_comment', { p_reply: r.id }), L('Comentario borrado.', 'Comment deleted.')) }],
    });

  const all = posts || [];
  const focus = params.post ? all.find((p) => p.id === params.post) : undefined;
  const list = all.filter(
    (p) =>
      p.id !== focus?.id &&
      (kind === 'all' || p.kind === kind) &&
      (store === 'all' || p.store_id === store || p.store_id === null) &&
      matches(q, p.text, p.author_name, p.ref_label, name(p.store_id), (p.post_replies || []).map((r) => r.text).join(' ')),
  );
  const recos = all.filter((p) => p.kind === 'reco' && p.stars && !p.hidden && (store === 'all' || p.store_id === store));
  const avg = recos.length ? recos.reduce((a, p) => a + p.stars, 0) / recos.length : 0;

  const card = (p: Post) => (
    <PostCard
      key={p.id}
      p={p}
      storeName={name(p.store_id)}
      liked={liked.has(p.id)}
      onLike={p.hidden ? undefined : () => like(p)}
      mine={mine(p)}
      onMenu={() => postMenu(p)}
      onReplyMenu={replyMenu}
      replyMenuFor={mine}
      commentBox={
        p.hidden ? (
          <Note kind="red">{L('Tu publicación se ocultó y solo tú la ves.', 'Your post was hidden and only you can see it.')}</Note>
        ) : open === p.id ? (
          <View style={{ gap: 8 }}>
            <TextInput
              accessibilityLabel={L('Escribe un comentario', 'Write a comment')}
              value={draft}
              onChangeText={setDraft}
              placeholder={L('Escribe un comentario…', 'Write a comment…')}
              placeholderTextColor="#93A5BD"
              multiline
              maxLength={500}
              autoFocus
              style={{ minHeight: 64, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line2, backgroundColor: '#fff', padding: 12, fontSize: 15, color: C.ink, textAlignVertical: 'top' }}
            />
            <Row>
              <Btn small title={L('Comentar', 'Comment')} icon="chat" disabled={!draft.trim()} loading={busy} onPress={() => comment(p)} />
              <Btn small kind="ghost" title={L('Cancelar', 'Cancel')} onPress={() => { setOpen(null); setDraft(''); }} />
            </Row>
          </View>
        ) : (
          <Btn small kind="ghost" icon="chat" title={(p.post_replies || []).length ? L(`Comentar (${(p.post_replies || []).length})`, `Comment (${(p.post_replies || []).length})`) : L('Comentar', 'Comment')}
            onPress={() => { if (!needLogin()) { setOpen(p.id); setDraft(''); } }} style={{ alignSelf: 'flex-start' }} />
        )
      }
    />
  );

  return (
    <Screen wall="community">
      <BackBar title={L('Boca a boca', 'Word of mouth')} />
      <H1>{L('Boca a boca', 'Word of mouth')}</H1>
      <P muted>{L('Lo que la comunidad recomienda, pregunta y comparte. Avisos útiles, promociones y sugerencias para tu tienda.', 'What the community recommends, asks and shares. Useful notices, deals and suggestions for your store.')}</P>
      <Btn icon="chat" title={L('Compartir algo', 'Share something')} onPress={() => (needLogin() ? undefined : router.push('/comunidad/nueva'))} />
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      {err ? <Note kind="red">{err}</Note> : null}

      {focus ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '900', color: C.brown }}>{L('La publicación de tu aviso', 'The post from your notification')}</Text>
          {card(focus)}
          <Btn small kind="ghost" title={L('Ver todas las publicaciones', 'See all posts')} onPress={() => router.setParams({ post: undefined })} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}

      {commStores.length > 1 ? (
        <Pills options={[{ v: 'all', label: L('Todas las tiendas', 'All stores') }, ...commStores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store', img: s.fotos?.[0] || null }))]} value={store} onChange={setStore} />
      ) : null}
      {recos.length ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: C.ink }}>{avg.toFixed(1)}</Text>
          <Row gap={6} style={{ flex: 1 }}>
            <Stars value={avg} size={20} />
            <P small muted>{L(`${recos.length} recomendaciones`, `${recos.length} recommendations`)}</P>
          </Row>
        </Card>
      ) : null}
      <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca en lo que dice la comunidad', 'Search what people say')} count={q ? list.length : undefined} />
      <Pills options={[{ v: 'all' as const, label: L('Todo', 'All') }, ...(Object.keys(K) as PostKind[]).map((k) => ({ v: k, label: K[k].label }))]} value={kind} onChange={setKind} />
      {!posts ? <Loading /> : null}
      {posts && list.length === 0 ? <Empty>{L('Aún no hay publicaciones aquí. ¡Sé el primero en compartir!', 'No posts here yet. Be the first to share!')}</Empty> : null}
      {list.map(card)}
      <P small muted style={{ textAlign: 'center' }}>{L('Publica con respeto. Por tu seguridad, nunca compartas números de cuenta, teléfonos ni tu dirección. Si ves algo que no va, toca ⋮ → Reportar.', 'Post respectfully. For your safety, never share account numbers, phone numbers or your address. If you see something wrong, tap ⋮ → Report.')}</P>

      <ActionSheet visible={!!sheet} title={sheet?.title} items={sheet?.items || []} onClose={() => setSheet(null)} />
    </Screen>
  );
}
