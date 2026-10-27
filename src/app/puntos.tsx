import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { BackBar, Btn, Card, H1, IcoBox, Loading, Note, P, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { storeShort, useStores } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { loyaltyOf, useMyPoints } from '@/lib/points';
import { C, R } from '@/lib/theme';

export default function Puntos() {
  const { L, lang } = useLang();
  const { session, profile } = useAuth();
  const { data: stores } = useStores();
  const { rows, balance } = useMyPoints(session?.user.id);
  const [open, setOpen] = useState<string | null>(null);
  if (!stores || !rows) return <Loading />;
  const bdayMonth = profile?.fecha_nac && new Date(profile.fecha_nac + 'T12:00:00').getMonth() === new Date().getMonth();
  const list = stores.filter((s) => s.activo).sort((a, b) => (a.id === profile?.store_id ? -1 : b.id === profile?.store_id ? 1 : 0));

  return (
    <Screen wall="pts">
      <BackBar title={L('Mis puntos', 'My points')} />
      <H1>{L('Tus puntos', 'Your points')}</H1>
      <P muted>{L('Cada tienda tiene su propio programa. Ganas puntos en cada compra o servicio, en la app o en el mostrador con tu tarjeta.', 'Each store has its own program. Earn points on every purchase or service, in the app or at the counter with your card.')}</P>
      <Btn icon="qr" title={L('Mostrar mi tarjeta', 'Show my card')} onPress={() => router.push('/tarjeta')} />
      {bdayMonth ? (
        <Note kind="gold" icon="gift">
          {L(`¡Feliz cumpleaños, ${profile?.nombre}! Este mes te regalamos puntos extra en las tiendas participantes.`, `Happy birthday, ${profile?.nombre}! This month you get bonus points at participating stores.`)}
        </Note>
      ) : null}
      {list.map((st) => {
        const ly = loyaltyOf(st);
        const bal = balance(st.id);
        const next = ly?.rewards.find((r) => r.pts > bal);
        const top = ly?.rewards.at(-1)?.pts || 0;
        const goal = next ? next.pts : top;
        const pct = goal ? Math.min(100, Math.round((bal / goal) * 100)) : 100;
        const moves = rows.filter((r) => r.store_id === st.id);
        const nm = (r: { es: string; en: string }) => (lang === 'es' ? r.es : r.en) || r.es;
        return (
          <Card key={st.id}>
            <Row gap={12} style={{ flexWrap: 'nowrap' }}>
              {st.fotos?.[0] ? <Image source={{ uri: st.fotos[0] }} style={{ width: 52, height: 52, borderRadius: 14 }} /> : <IcoBox n="store" size={52} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '900', color: C.ink }} numberOfLines={1}>{storeShort(st)}</Text>
                <P small muted>{st.ciudad}</P>
              </View>
            </Row>
            {ly ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 40, fontWeight: '900', color: C.ink }}>{bal}</Text>
                  <Text style={{ color: C.muted, fontWeight: '800' }}>{L('pts', 'pts')}</Text>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: C.tint, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.gold }} />
                </View>
                <Text style={{ fontWeight: '800', color: C.ink }}>
                  {next ? L(`Te faltan ${next.pts - bal} pts para: ${nm(next)}`, `${next.pts - bal} pts to go for: ${nm(next)}`) : L('¡Ya puedes canjear todos los premios!', 'You can redeem every reward!')}
                </Text>
                <P small muted>
                  {L(`Ganas ${ly.perTx} pts por pedido`, `Earn ${ly.perTx} pts per order`)}
                  {ly.per100 ? L(` + ${ly.per100} por cada $100`, ` + ${ly.per100} for every $100`) : ''}
                  {ly.postPts ? L(` · ${ly.postPts} por compartir en Boca a boca (una vez a la semana)`, ` · ${ly.postPts} for sharing in Word of mouth (once a week)`) : ''}.
                </P>
                <Text style={{ fontWeight: '900', color: C.ink, marginTop: 4 }}>{L('Premios', 'Rewards')}</Text>
                {ly.rewards.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: R.md, backgroundColor: C.cream }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.ink }}>{nm(r)}</Text>
                      <P small muted>{r.pts} pts · {r.type === 'fee' ? L('Sin comisión en tu pedido', 'No fee on your order') : L(`$${r.value} de descuento`, `$${r.value} off`)}</P>
                    </View>
                    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bal >= r.pts ? '#DDF1E4' : C.tint }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: bal >= r.pts ? '#1E5B35' : C.muted }}>{bal >= r.pts ? L('Disponible', 'Available') : L(`Faltan ${r.pts - bal}`, `${r.pts - bal} to go`)}</Text>
                    </View>
                  </View>
                ))}
                <P small muted>{L('Úsalos al pagar en la app o pídelos en el mostrador.', 'Use them when paying in the app or ask at the counter.')}</P>
                {moves.length ? (
                  <Pressable onPress={() => setOpen(open === st.id ? null : st.id)}>
                    <Text style={{ color: C.blue, fontWeight: '800' }}>{open === st.id ? L('Ocultar movimientos', 'Hide activity') : L(`Ver movimientos (${moves.length})`, `See activity (${moves.length})`)}</Text>
                  </Pressable>
                ) : null}
                {open === st.id
                  ? moves.map((m) => (
                      <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.ink }}>{m.motivo}</Text>
                          <P small muted>{new Date(m.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US')}</P>
                        </View>
                        <Text style={{ fontWeight: '900', color: m.pts < 0 ? C.red : C.blueInk }}>{m.pts > 0 ? '+' : ''}{m.pts}</Text>
                      </View>
                    ))
                  : null}
              </View>
            ) : (
              <P small muted>{L('Esta tienda todavía no tiene programa de puntos.', 'This store has no points program yet.')}</P>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
