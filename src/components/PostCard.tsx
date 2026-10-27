/** Una publicación de Boca a boca (la usan el cliente y la tienda). */
import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Stars } from '@/components/Stars';
import { Text } from '@/components/Text';
import { Avatar, Icon } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Post, PostKind, PostReply } from '@/lib/types';

export function usePostKinds() {
  const { L } = useLang();
  const K: Record<PostKind, { label: string; bg: string; fg: string }> = {
    reco: { label: L('Recomendación', 'Recommendation'), bg: '#DDF1E4', fg: '#1E5B35' },
    prod: { label: L('Producto', 'Product'), bg: C.blueSoft, fg: C.blueInk },
    promo: { label: L('Promoción', 'Deal'), bg: C.goldSoft, fg: C.goldInk },
    sug: { label: L('Sugerencia', 'Suggestion'), bg: '#EDE7FB', fg: '#4B3A8C' },
    store: { label: L('De la tienda', 'From the store'), bg: C.tint, fg: C.brown },
    aviso: { label: L('Aviso útil', 'Useful notice'), bg: '#FDE7C8', fg: '#7A4A00' },
  };
  return K;
}

export function useHideReasons() {
  const { L } = useLang();
  return [
    { v: 'ofensivo' as const, label: L('Lenguaje ofensivo', 'Offensive language') },
    { v: 'spam' as const, label: L('Spam o publicidad', 'Spam or advertising') },
    { v: 'datos' as const, label: L('Datos personales', 'Personal information') },
    { v: 'otro' as const, label: L('Otro motivo', 'Other reason') },
  ];
}

export function PostCard({
  p,
  storeName,
  liked,
  onLike,
  footer,
  onMenu,
  mine,
  onReplyMenu,
  replyMenuFor,
  showReports,
  commentBox,
}: {
  p: Post;
  storeName: string;
  liked?: boolean;
  onLike?: () => void;
  footer?: React.ReactNode;
  /** Si viene, se muestra el botón ⋮ con las opciones */
  onMenu?: () => void;
  mine?: boolean;
  /** ⋮ en cada comentario (para la tienda: ocultar; para el autor: borrar) */
  onReplyMenu?: (r: PostReply) => void;
  /** En qué comentarios mostrar el ⋮ (por defecto en todos) */
  replyMenuFor?: (r: PostReply) => boolean;
  /** Mostrar cuántas veces la reportaron (solo para la tienda) */
  showReports?: boolean;
  /** Caja para comentar, debajo de los comentarios */
  commentBox?: React.ReactNode;
}) {
  const { L, lang } = useLang();
  const K = usePostKinds();
  const reasons = useHideReasons();
  const k = K[p.kind];
  const replies = (p.post_replies || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <View style={{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: p.hidden ? '#F3C6BE' : C.line, padding: 14, gap: 8, opacity: p.hidden ? 0.85 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={p.author_name} size={38} uri={p.author_foto} me={p.kind === 'store' || p.kind === 'aviso'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontWeight: '900', color: C.ink, flexShrink: 1 }} numberOfLines={1}>{p.author_name}{mine ? L(' (tú)', ' (you)') : ''}</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
            {p.verified ? <Text style={{ color: '#1E5B35', fontWeight: '900' }}>✓ {L('Cliente verificado', 'Verified customer')} · </Text> : null}
            {timeAgo(p.created_at, lang)} · {storeName}
          </Text>
        </View>
        <View style={{ backgroundColor: k.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: k.fg }}>{k.label}</Text>
        </View>
        {onMenu ? (
          <Pressable accessibilityRole="button" accessibilityLabel={L('Opciones', 'Options')} onPress={onMenu} hitSlop={10}
            style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: -6, backgroundColor: pressed ? C.tint : 'transparent' })}>
            <Icon n="dots" size={22} color={C.ink} sw={2.6} />
          </Pressable>
        ) : null}
      </View>
      {p.hidden ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#F7DCD6', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: C.red }}>
            {L('Oculto', 'Hidden')} · {reasons.find((r) => r.v === p.hide_reason)?.label || ''}
            {p.hidden_by ? ' · ' + p.hidden_by : ''}
          </Text>
        </View>
      ) : null}
      {showReports && p.reports ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#FDE7C8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#7A4A00' }}>⚑ {L(`Reportada ${p.reports} ${p.reports === 1 ? 'vez' : 'veces'}`, `Reported ${p.reports}×`)}</Text>
        </View>
      ) : null}
      {p.kind === 'reco' && p.stars ? <Stars value={p.stars} size={18} /> : null}
      <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }}>{p.text}</Text>
      {p.photo_url ? <Image source={{ uri: p.photo_url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: C.tint }} resizeMode="cover" accessibilityLabel={L('Foto de la publicación', 'Post photo')} /> : null}
      {p.ref_id && p.ref_type ? (
        <Pressable
          onPress={() => router.push(p.ref_type === 'product' ? { pathname: '/producto/[id]', params: { id: p.ref_id! } } : { pathname: '/servicio/[id]', params: { id: p.ref_id! } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Icon n={p.ref_type === 'product' ? 'bag' : 'tool'} size={14} color={C.brown} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.brown }}>{p.ref_label || L('Ver', 'View')}</Text>
        </Pressable>
      ) : null}
      {replies.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', gap: 8, marginLeft: 12, opacity: r.hidden ? 0.6 : 1 }}>
          {r.is_store ? null : <Avatar name={r.author_name} size={28} uri={r.author_foto} me={false} />}
          <View style={{ flex: 1, backgroundColor: r.is_store ? C.blueSoft : C.tint, borderRadius: 12, padding: 10, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '900', color: r.is_store ? C.blueInk : C.brown }} numberOfLines={1}>
                {r.author_name}
                <Text style={{ fontWeight: '600', color: C.muted }}> · {timeAgo(r.created_at, lang)}</Text>
              </Text>
              {onReplyMenu && (!replyMenuFor || replyMenuFor(r)) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={L('Opciones del comentario', 'Comment options')} onPress={() => onReplyMenu(r)} hitSlop={10}>
                  <Icon n="dots" size={16} color={C.muted} sw={2.6} />
                </Pressable>
              ) : null}
            </View>
            {r.hidden ? <Text style={{ fontSize: 11, fontWeight: '900', color: C.red }}>{L('Comentario oculto', 'Hidden comment')}</Text> : null}
            <Text style={{ color: C.ink }}>{r.text}</Text>
          </View>
        </View>
      ))}
      {commentBox}
      {onLike ? (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !!liked }} onPress={onLike} hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 }}>
          <Icon n="heart" size={18} color={liked ? C.red : C.muted} />
          <Text style={{ fontWeight: '800', color: liked ? C.red : C.muted }}>{p.likes ? p.likes : ''} {L('Me sirvió', 'Helpful')}</Text>
        </Pressable>
      ) : p.likes ? (
        <Text style={{ fontSize: 12, color: C.muted }}>♥ {p.likes} {L('personas dicen que les sirvió', 'people found this helpful')}</Text>
      ) : null}
      {footer}
    </View>
  );
}
