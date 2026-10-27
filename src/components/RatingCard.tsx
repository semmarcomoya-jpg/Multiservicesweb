/** Al terminar un pedido: "¿Cómo te atendió Sandra?" (igual que la maqueta). */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { StarPicker, Stars } from '@/components/Stars';
import { Text } from '@/components/Text';
import { Btn, Card, Field, Note, P, Pills } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Order, Rating } from '@/lib/types';

export function RatingCard({ order }: { order: Order }) {
  const { L } = useLang();
  const [rating, setRating] = useState<Rating | null | undefined>(undefined);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    supabase.from('ratings').select('*').eq('order_id', order.id).maybeSingle().then(({ data }) => setRating((data as Rating) ?? null));
  }, [order.id]);

  if (order.status !== 'completado' || rating === undefined) return null;
  const who = order.attended_name || L('la tienda', 'the store');

  if (rating)
    return (
      <Card>
        <Text style={{ fontWeight: '900', color: C.ink }}>{L('Tu calificación', 'Your rating')}</Text>
        <Stars value={rating.stars} size={22} />
        {rating.tags.length ? <P small muted>{rating.tags.join(' · ')}</P> : null}
        {rating.comment ? <P>{rating.comment}</P> : null}
        {thanks ? <Note kind="blue" icon="check">{L('¡Gracias! Tu calificación ayuda a mejorar el servicio.', 'Thanks! Your rating helps us improve.')}</Note> : null}
      </Card>
    );

  const TAGS = [L('Rápido', 'Fast'), L('Amable', 'Friendly'), L('Me explicó bien', 'Explained well'), L('Puntual', 'On time'), L('Buen precio', 'Good price')];
  const send = async () => {
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.rpc('rate_order', { p_order: order.id, p_stars: stars, p_tags: tags, p_comment: comment.trim() }).single<Rating>();
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setThanks(true);
    setRating(data);
  };

  return (
    <Card style={{ borderWidth: 2, borderColor: C.gold }}>
      <Text style={{ fontSize: 19, fontWeight: '900', color: C.ink }}>{L(`¿Cómo te atendió ${who}?`, `How did ${who} do?`)}</Text>
      <StarPicker value={stars} onChange={setStars} />
      {stars ? (
        <View style={{ gap: 10 }}>
          <MultiPills options={TAGS} value={tags} onChange={setTags} />
          <Field label={L('Comentario (opcional)', 'Comment (optional)')} value={comment} onChangeText={setComment} multiline maxLength={500} />
          {err ? <Note kind="red">{err}</Note> : null}
          <Btn title={L('Enviar calificación', 'Send rating')} onPress={send} loading={busy} />
        </View>
      ) : (
        <P small muted>{L('Toca las estrellas. Solo lo ve la tienda.', 'Tap the stars. Only the store sees it.')}</P>
      )}
    </Card>
  );
}

/** Varias opciones a la vez (etiquetas). */
function MultiPills({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Pills
      options={options.map((o) => ({ v: o, label: (value.includes(o) ? '✓ ' : '') + o }))}
      value={null}
      onChange={(o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
    />
  );
}
