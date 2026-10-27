import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';

import { PostCard, usePostKinds } from '@/components/PostCard';
import { Stars } from '@/components/Stars';
import { Text } from '@/components/Text';
import { BackBar, Btn, Card, Empty, H1, Loading, P, Pills, Row, Screen, SearchBox, matches } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { modOn, storeShort, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Post, PostKind } from '@/lib/types';

export default function Comunidad() {
  const { L } = useLang();
  const { session } = useAuth();
  const { data: stores } = useStores();
  const K = usePostKinds();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'all' | PostKind>('all');
  const [store, setStore] = useState('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    supabase
      .from('posts')
      .select('*, post_replies(*)')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setErr(errMsg(error));
        setPosts((data as Post[]) ?? []);
      });
    if (session)
      supabase.from('post_likes').select('post_id').then(({ data }) => setLiked(new Set((data || []).map((x: { post_id: string }) => x.post_id))));
  }, [session]);
  useFocusEffect(load);

  const commStores = (stores || []).filter((s) => s.activo && modOn(s, 'comm'));
  const name = (id: string) => {
    const s = (stores || []).find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };
  const like = async (p: Post) => {
    if (!session) return router.push('/entrar');
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

  const list = (posts || []).filter((p) => (kind === 'all' || p.kind === kind) && (store === 'all' || p.store_id === store) && matches(q, p.text, p.author_name, p.ref_label, name(p.store_id)));
  // Promedio de estrellas de las recomendaciones de la tienda elegida
  const recos = (posts || []).filter((p) => p.kind === 'reco' && p.stars && (store === 'all' || p.store_id === store));
  const avg = recos.length ? recos.reduce((a, p) => a + p.stars, 0) / recos.length : 0;

  return (
    <Screen wall="community">
      <BackBar title={L('Boca a boca', 'Word of mouth')} />
      <H1>{L('Boca a boca', 'Word of mouth')}</H1>
      <P muted>{L('Lo que la comunidad recomienda: servicios, productos, promociones y sugerencias para tu tienda.', 'What the community recommends: services, products, deals and suggestions for your store.')}</P>
      <Btn icon="chat" title={L('Compartir mi experiencia', 'Share my experience')} onPress={() => router.push('/comunidad/nueva')} />
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
      {err ? <P style={{ color: C.red }}>{err}</P> : null}
      {!posts ? <Loading /> : null}
      {posts && list.length === 0 ? <Empty>{L('Aún no hay publicaciones aquí. ¡Sé el primero en compartir!', 'No posts here yet. Be the first to share!')}</Empty> : null}
      {list.map((p) => (
        <PostCard key={p.id} p={p} storeName={name(p.store_id)} liked={liked.has(p.id)} onLike={() => like(p)} mine={!!session && p.user_id === session.user.id} />
      ))}
      <P small muted style={{ textAlign: 'center' }}>{L('Publica con respeto. Por tu seguridad, nunca compartas números de cuenta, teléfonos ni tu dirección.', 'Post respectfully. For your safety, never share account numbers, phone numbers or your address.')}</P>
    </Screen>
  );
}
