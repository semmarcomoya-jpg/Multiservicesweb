/** Una publicación de Boca a boca (la usan el cliente y la tienda). */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Stars } from '@/components/Stars';
import { Text } from '@/components/Text';
import { Avatar, Icon } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import type { Post, PostKind } from '@/lib/types';

export function usePostKinds() {
  const { L } = useLang();
  const K: Record<PostKind, { label: string; bg: string; fg: string }> = {
    reco: { label: L('Recomendación', 'Recommendation'), bg: '#DDF1E4', fg: '#1E5B35' },
    prod: { label: L('Producto', 'Product'), bg: C.blueSoft, fg: C.blueInk },
    promo: { label: L('Promoción', 'Deal'), bg: C.goldSoft, fg: C.goldInk },
    sug: { label: L('Sugerencia', 'Suggestion'), bg: '#EDE7FB', fg: '#4B3A8C' },
    store: { label: L('De la tienda', 'From the store'), bg: C.tint, fg: C.brown },
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
  mine,
}: {
  p: Post;
  storeName: string;
  liked?: boolean;
  onLike?: () => void;
  footer?: React.ReactNode;
  mine?: boolean;
}) {
  const { L, lang } = useLang();
  const K = usePostKinds();
  const reasons = useHideReasons();
  const k = K[p.kind];
  const replies = (p.post_replies || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <View style={{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: p.hidden ? '#F3C6BE' : C.line, padding: 14, gap: 8, opacity: p.hidden ? 0.85 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={p.author_name} size={38} uri={p.author_foto} me={p.kind === 'store'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: '900', color: C.ink }} numberOfLines={1}>{p.author_name}{mine ? L(' (tú)', ' (you)') : ''}</Text>
          <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{timeAgo(p.created_at, lang)} · {storeName}</Text>
        </View>
        <View style={{ backgroundColor: k.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: k.fg }}>{k.label}</Text>
        </View>
      </View>
      {p.hidden ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#F7DCD6', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: C.red }}>
            {L('Oculto', 'Hidden')} · {reasons.find((r) => r.v === p.hide_reason)?.label || ''}
            {p.hidden_by ? ' · ' + p.hidden_by : ''}
          </Text>
        </View>
      ) : null}
      {p.kind === 'reco' && p.stars ? <Stars value={p.stars} size={18} /> : null}
      <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }}>{p.text}</Text>
      {p.ref_id && p.ref_type ? (
        <Pressable
          onPress={() => router.push(p.ref_type === 'product' ? { pathname: '/producto/[id]', params: { id: p.ref_id! } } : { pathname: '/servicio/[id]', params: { id: p.ref_id! } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Icon n={p.ref_type === 'product' ? 'bag' : 'tool'} size={14} color={C.brown} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.brown }}>{p.ref_label || L('Ver', 'View')}</Text>
        </Pressable>
      ) : null}
      {replies.map((r) => (
        <View key={r.id} style={{ backgroundColor: C.tint, borderRadius: 12, padding: 10, marginLeft: 12, gap: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '900', color: C.brown }}>{r.author_name}</Text>
          <Text style={{ color: C.ink }}>{r.text}</Text>
        </View>
      ))}
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
