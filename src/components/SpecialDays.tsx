/** Tarjeta "Días especiales": fiestas de EE. UU., del país del cliente y de su estado, calculadas solas. */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Scene } from '@/components/scenes';
import { Text } from '@/components/Text';
import { Icon, P } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { countryOf } from '@/lib/countries';
import { useSettings } from '@/lib/data';
import { daysUntil, upcomingSpecials } from '@/lib/holidays';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

export function SpecialDays({ max = 4, compact }: { max?: number; compact?: boolean }) {
  const { L, lang } = useLang();
  const { profile } = useAuth();
  const { data: cfg } = useSettings();
  if (!profile) return null;
  const list = upcomingSpecials(profile.pais, profile.estado, cfg, 60).slice(0, max);
  const co = profile.pais ? countryOf(profile.pais) : null;
  const fmt = (d: Date) => d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  const when = (n: number) => (n === 0 ? L('Hoy', 'Today') : n === 1 ? L('Mañana', 'Tomorrow') : L(`En ${n} días`, `In ${n} days`));
  const flag = (k: string, where: string) => (k === 'us' ? '🇺🇸' : k === 'pais' ? co?.flag || '' : k === 'estado' ? '📍' : '⭐');

  return (
    <View style={{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, overflow: 'hidden' }}><Scene n="calendario" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{L('Días especiales', 'Special days')}</Text>
          <P small muted>
            {co ? L(`De ${co.es}${profile.estado ? ' · ' + profile.estado : ''} y de Estados Unidos`, `From ${co.en}${profile.estado ? ' · ' + profile.estado : ''} and the U.S.`) : L('De Estados Unidos', 'From the U.S.')}
          </P>
        </View>
      </View>
      {list.length ? (
        list.map((s, i) => {
          const n = daysUntil(s.date);
          return (
            <View key={s.es + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={{ width: 46, alignItems: 'center', paddingVertical: 4, borderRadius: 10, backgroundColor: n <= 3 ? '#FDEBC8' : C.blueSoft }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: n <= 3 ? '#7A4A00' : C.blueInk, textTransform: 'uppercase' }}>{s.date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short' })}</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: n <= 3 ? '#7A4A00' : C.blueInk }}>{s.date.getDate()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={2}>{flag(s.kind, s.where)} {lang === 'es' ? s.es : s.en}</Text>
                <P small muted>{when(n)}{compact ? '' : ' · ' + fmt(s.date)}</P>
              </View>
              {s.idea === 'send' && n <= 20 ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/enviar')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 34, borderRadius: R.pill, backgroundColor: C.brown }}>
                  <Icon n="send" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{L('Enviar', 'Send')}</Text>
                </Pressable>
              ) : s.idea === 'shop' && n <= 20 ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/productos')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 34, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.line2 }}>
                  <Icon n="gift" size={14} color={C.brown} />
                  <Text style={{ color: C.brown, fontWeight: '900', fontSize: 12 }}>{L('Regalo', 'Gift')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      ) : (
        <P small muted>{L('No hay días especiales en los próximos dos meses.', 'No special days in the next two months.')}</P>
      )}
      {!profile.pais ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/perfil')}>
          <Text style={{ color: C.blue, fontWeight: '800' }}>{L('Elige tu país en tu perfil para ver también los de tu tierra', 'Choose your country in your profile to also see the ones back home')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
