/** Boca a boca para la tienda y el administrador: publicar como tienda, responder y ocultar (con motivo). */
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { PostCard, useHideReasons, usePostKinds } from '@/components/PostCard';
import { Btn, Card, Empty, Field, H2, Loading, Note, Pills, Row, SearchBox, matches, P } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { storeShort } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import type { Post, PostKind, PostReply, Store } from '@/lib/types';
import { C } from '@/lib/theme';
import { pickImage, uploadImage, type Picked } from '@/lib/upload';

export function ComunidadPanel({ stores, storeId }: { stores: Store[]; storeId?: string | null }) {
  const { L } = useLang();
  const K = usePostKinds();
  const reasons = useHideReasons();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [st, setSt] = useState<string>(storeId || 'all');
  const [kind, setKind] = useState<'all' | PostKind | 'hidden' | 'reported'>('all');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [pubKind, setPubKind] = useState<'store' | 'aviso'>('store');
  const [pubPhoto, setPubPhoto] = useState<Picked | null>(null);
  const [replyMenu, setReplyMenu] = useState<PostReply | null>(null);
  const [pubStore, setPubStore] = useState<string | null>(storeId || stores[0]?.id || null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [menu, setMenu] = useState<Post | null>(null);
  const [step, setStep] = useState<'main' | 'hide' | 'delete'>('main');
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    let qy = supabase.from('posts').select('*, post_replies(*)').order('created_at', { ascending: false }).limit(500);
    if (storeId) qy = qy.or(`store_id.eq.${storeId},store_id.is.null`);
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
  const name = (id: string | null) => {
    if (!id) return L('Todas las tiendas', 'All stores');
    const s = stores.find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };

  if (!posts) return <Loading />;
  const list = posts.filter(
    (p) =>
      (st === 'all' || p.store_id === st) &&
      (kind === 'all' || (kind === 'hidden' ? p.hidden : kind === 'reported' ? p.reports > 0 && !p.hidden : p.kind === kind)) &&
      matches(q, p.text, p.author_name, p.ref_label, name(p.store_id), (p.post_replies || []).map((r) => r.text).join(' ')),
  );
  const nHidden = posts.filter((p) => p.hidden && (st === 'all' || p.store_id === st)).length;
  const nReported = posts.filter((p) => p.reports > 0 && !p.hidden && (st === 'all' || p.store_id === st)).length;

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
        <Pills
          label={L('¿Qué vas a publicar?', 'What are you posting?')}
          options={[
            { v: 'store' as const, label: L('Novedad o promoción de la tienda', 'Store news or deal'), icon: 'store' },
            { v: 'aviso' as const, label: L('Aviso útil para la comunidad', 'Useful community notice'), icon: 'megaphone' },
          ]}
          value={pubKind}
          onChange={(v) => {
            setPubKind(v);
            if (v === 'store' && pubStore === '__all') setPubStore(stores[0]?.id || null);
          }}
        />
        {pubKind === 'aviso' ? <P small muted>{L('Ej.: consulado móvil, ferias de salud, trámites, eventos de la colonia. Lo ven aunque no vayan a comprar.', 'E.g. mobile consulate, health fairs, paperwork, neighborhood events. People see it even if they are not shopping.')}</P> : null}
        {!storeId ? (
          <Pills
            label={L('¿De qué tienda?', 'Which store?')}
            options={[...(pubKind === 'aviso' && isAdmin ? [{ v: '__all', label: L('Todas las tiendas', 'All stores'), icon: 'globe', img: null as string | null }] : []), ...stores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store', img: s.fotos?.[0] || null }))]}
            value={pubStore}
            onChange={setPubStore}
          />
        ) : null}
        <Field label={pubKind === 'aviso' ? L('Aviso para la comunidad', 'Community notice') : L('Novedad o promoción', 'News or deal')} value={draft} onChangeText={setDraft} multiline maxLength={600} />
        {pubPhoto ? (
          <Row>
            <Image source={{ uri: pubPhoto.uri }} style={{ width: 120, height: 90, borderRadius: 12, backgroundColor: C.tint }} />
            <Btn small kind="ghost" title={L('Quitar foto', 'Remove photo')} onPress={() => setPubPhoto(null)} />
          </Row>
        ) : (
          <Btn small kind="ghost" icon="camera" title={L('Agregar foto (opcional)', 'Add photo (optional)')} onPress={async () => setPubPhoto(await pickImage())} style={{ alignSelf: 'flex-start' }} />
        )}
        <Btn
          title={L('Publicar', 'Post')}
          icon="chat"
          disabled={!draft.trim() || !pubStore}
          loading={busy === 'pub'}
          onPress={() =>
            run(
              'pub',
              async () => {
                let photo: string | null = null;
                if (pubPhoto && profile) {
                  try {
                    const path = await uploadImage('comunidad', profile.id, pubPhoto);
                    photo = supabase.storage.from('comunidad').getPublicUrl(path).data.publicUrl;
                  } catch (e) {
                    return { error: e };
                  }
                }
                return supabase.rpc('create_post', { p_store: pubStore === '__all' ? null : pubStore, p_kind: pubKind, p_stars: 0, p_text: draft.trim(), p_ref_type: null, p_ref_id: null, p_ref_label: '', p_photo: photo });
              },
              () => {
                setDraft('');
                setPubPhoto(null);
              },
            )
          }
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
          { v: 'reported' as const, label: L(`⚑ Reportadas · ${nReported}`, `⚑ Reported · ${nReported}`) },
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
          showReports
          onReplyMenu={setReplyMenu}
          onMenu={() => {
            setMenu(p);
            setStep('main');
          }}
          footer={
            replyOpen === p.id ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Field label={L('Tu respuesta pública', 'Your public reply')} value={reply[p.id] || ''} onChangeText={(v) => setReply((r) => ({ ...r, [p.id]: v }))} multiline maxLength={500} />
                <Row>
                  <Btn
                    small
                    title={L('Publicar respuesta', 'Post reply')}
                    disabled={!(reply[p.id] || '').trim()}
                    loading={busy === 'r' + p.id}
                    onPress={() => run('r' + p.id, () => supabase.rpc('reply_post', { p_post: p.id, p_text: (reply[p.id] || '').trim() }), () => { setReply((r) => ({ ...r, [p.id]: '' })); setReplyOpen(null); })}
                  />
                  <Btn small kind="ghost" title={L('Cancelar', 'Cancel')} onPress={() => setReplyOpen(null)} />
                </Row>
              </View>
            ) : null
          }
        />
      ))}

      {/* Menú ⋮ de cada publicación */}
      <ActionSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={
          !menu ? '' : step === 'hide' ? L('¿Por qué la ocultas?', 'Why are you hiding it?') : step === 'delete' ? L('¿Borrar para siempre?', 'Delete forever?') : `${menu.author_name}: ${menu.text}`
        }
        items={
          !menu
            ? []
            : step === 'hide'
              ? reasons.map((r) => ({
                  key: r.v,
                  label: r.label,
                  onPress: () => {
                    const p = menu;
                    setMenu(null);
                    run('h' + p.id, () => supabase.rpc('moderate_post', { p_post: p.id, p_hide: true, p_reason: r.v }));
                  },
                }))
              : step === 'delete'
                ? [
                    {
                      key: 'yes',
                      label: L('Sí, borrar para siempre', 'Yes, delete forever'),
                      sub: L('No se puede deshacer. Queda registrado en la Bitácora.', 'This cannot be undone. It is recorded in the activity log.'),
                      icon: 'x',
                      danger: true,
                      onPress: () => {
                        const p = menu;
                        setMenu(null);
                        run('d' + p.id, () => supabase.rpc('admin_delete_post', { p_post: p.id, p_reason: p.hide_reason || 'otro' }));
                      },
                    },
                  ]
                : [
                    { key: 'reply', label: L('Responder', 'Reply'), icon: 'chat', onPress: () => { setReplyOpen(menu.id); setMenu(null); } },
                    menu.hidden
                      ? {
                          key: 'show',
                          label: L('Mostrar de nuevo', 'Show again'),
                          icon: 'eye',
                          onPress: () => {
                            const p = menu;
                            setMenu(null);
                            run('h' + p.id, () => supabase.rpc('moderate_post', { p_post: p.id, p_hide: false, p_reason: '' }));
                          },
                        }
                      : { key: 'hide', label: L('Ocultar…', 'Hide…'), sub: L('Ofensivo, spam o datos personales', 'Offensive, spam or personal info'), icon: 'lock', onPress: () => setStep('hide') },
                    ...(isAdmin ? [{ key: 'del', label: L('Borrar definitivamente…', 'Delete permanently…'), icon: 'x', danger: true, onPress: () => setStep('delete') }] : []),
                  ]
        }
      />

      {/* Menú ⋮ de cada comentario */}
      <ActionSheet
        visible={!!replyMenu}
        onClose={() => setReplyMenu(null)}
        title={replyMenu ? `${replyMenu.author_name}: ${replyMenu.text}` : ''}
        items={
          !replyMenu
            ? []
            : replyMenu.hidden
              ? [{ key: 'show', label: L('Mostrar de nuevo', 'Show again'), icon: 'eye', onPress: () => { const r = replyMenu; setReplyMenu(null); run('c' + r.id, () => supabase.rpc('moderate_reply', { p_reply: r.id, p_hide: false, p_reason: '' })); } }]
              : reasons.map((rs) => ({
                  key: rs.v,
                  label: L('Ocultar: ', 'Hide: ') + rs.label.toLowerCase(),
                  icon: 'lock',
                  onPress: () => {
                    const r = replyMenu;
                    setReplyMenu(null);
                    run('c' + r.id, () => supabase.rpc('moderate_reply', { p_reply: r.id, p_hide: true, p_reason: rs.v }));
                  },
                }))
        }
      />
    </>
  );
}
