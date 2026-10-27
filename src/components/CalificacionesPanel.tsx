/** Calificaciones del servicio: promedio, por empleado y comentarios (1–2 ★ para dar seguimiento). */
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Stars } from '@/components/Stars';
import { Text } from '@/components/Text';
import { Btn, Card, Empty, H2, Loading, Note, P, Pills, Row, SearchBox, matches } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { storeShort } from '@/lib/data';
import { timeAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Rating, Store } from '@/lib/types';

type Row2 = Rating & { orders?: { folio: string; cliente_nombre: string; kind: string; service_name: { es?: string; en?: string } | null; items: { name: string }[] | null } | null };

export function CalificacionesPanel({ stores, storeId }: { stores: Store[]; storeId?: string | null }) {
  const { L, lang } = useLang();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row2[] | null>(null);
  const [st, setSt] = useState<string>(storeId || 'all');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'low'>('all');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    let qy = supabase.from('ratings').select('*, orders(folio, cliente_nombre, kind, service_name, items)').order('created_at', { ascending: false }).limit(1000);
    if (storeId) qy = qy.eq('store_id', storeId);
    qy.then(({ data, error }) => {
      if (error) setErr(errMsg(error));
      setRows((data as Row2[]) ?? []);
    });
  }, [storeId]);
  useFocusEffect(load);

  if (!rows) return <Loading />;
  const sel = rows.filter((r) => st === 'all' || r.store_id === st);
  const avg = sel.length ? sel.reduce((a, r) => a + r.stars, 0) / sel.length : 0;
  const low = sel.filter((r) => r.stars <= 2 && !r.followed_up);
  const byEmp = new Map<string, { name: string; store: string; n: number; sum: number }>();
  sel.forEach((r) => {
    const k = (r.employee_name || L('Sin asignar', 'Unassigned')) + '|' + r.store_id;
    const e = byEmp.get(k) || { name: r.employee_name || L('Sin asignar', 'Unassigned'), store: r.store_id, n: 0, sum: 0 };
    e.n += 1;
    e.sum += r.stars;
    byEmp.set(k, e);
  });
  const emps = [...byEmp.values()].sort((a, b) => b.sum / b.n - a.sum / a.n);
  const sName = (id: string) => {
    const s = stores.find((x) => x.id === id);
    return s ? storeShort(s) : '';
  };
  const what = (r: Row2) => {
    const o = r.orders;
    if (!o) return '';
    if (o.kind === 'send') return L('Envío a México', 'Transfer to Mexico');
    if (o.kind === 'shop') return (o.items || []).map((x) => x.name).join(', ');
    return (lang === 'es' ? o.service_name?.es : o.service_name?.en) || '';
  };
  const list = sel.filter((r) => (only === 'all' || (r.stars <= 2 && !r.followed_up)) && matches(q, r.employee_name, r.comment, r.tags.join(' '), r.orders?.folio, r.orders?.cliente_nombre, what(r)));

  const follow = async (r: Rating) => {
    const who = `${profile?.nombre || ''} ${profile?.apellidos || ''}`.trim();
    const { error } = await supabase.from('ratings').update({ followed_up: true, followed_by: who, followed_at: new Date().toISOString() }).eq('id', r.id);
    if (error) setErr(errMsg(error));
    load();
  };

  const tile = (label: string, value: React.ReactNode) => (
    <View style={{ flexGrow: 1, flexBasis: 180, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 16, gap: 6 }}>
      <P small muted>{label}</P>
      {value}
    </View>
  );

  return (
    <>
      {!storeId && stores.length > 1 ? (
        <Pills options={[{ v: 'all', label: L('Todas las tiendas', 'All stores') }, ...stores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store', img: s.fotos?.[0] || null }))]} value={st} onChange={setSt} />
      ) : null}
      {err ? <Note kind="red">{err}</Note> : null}
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        {tile(
          L('Promedio general', 'Overall average'),
          <Row gap={8}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.ink }}>{sel.length ? avg.toFixed(1) : '—'}</Text>
            <Stars value={avg} size={18} />
          </Row>,
        )}
        {tile(L('Calificaciones', 'Ratings'), <Text style={{ fontSize: 30, fontWeight: '900', color: C.ink }}>{sel.length}</Text>)}
        {tile(L('Para dar seguimiento (1–2 ★)', 'To follow up (1–2 ★)'), <Text style={{ fontSize: 30, fontWeight: '900', color: low.length ? C.red : C.ink }}>{low.length}</Text>)}
      </Row>

      <Card>
        <H2>{L('Por empleado', 'By employee')}</H2>
        {emps.length === 0 ? <P muted>{L('Aún no hay calificaciones. Los clientes califican cuando su pedido queda completado.', 'No ratings yet. Customers rate when their order is completed.')}</P> : null}
        {emps.map((e) => {
          const a = e.sum / e.n;
          return (
            <View key={e.name + e.store} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <Text style={{ flex: 1, color: C.ink }} numberOfLines={1}>
                  <Text style={{ fontWeight: '900' }}>{e.name}</Text>
                  <Text style={{ color: C.muted }}> · {sName(e.store)} · {e.n} {e.n === 1 ? L('calificación', 'rating') : L('calificaciones', 'ratings')}</Text>
                </Text>
                <Text style={{ fontWeight: '900', color: C.ink }}>{a.toFixed(1)}</Text>
                <Stars value={a} size={14} />
              </Row>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: C.tint, overflow: 'hidden' }}>
                <View style={{ width: `${(a / 5) * 100}%`, height: '100%', backgroundColor: C.gold, borderRadius: 5 }} />
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <H2>{L('Comentarios recientes', 'Recent comments')}</H2>
        <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca empleado, cliente, folio o comentario', 'Search employee, customer, ref or comment')} count={q ? list.length : undefined} />
        <Pills options={[{ v: 'all' as const, label: L('Todas', 'All') }, { v: 'low' as const, label: L(`Para dar seguimiento · ${low.length}`, `To follow up · ${low.length}`) }]} value={only} onChange={setOnly} />
        {list.length === 0 ? <Empty>{L('Nada por aquí.', 'Nothing here.')}</Empty> : null}
        {list.slice(0, 200).map((r) => {
          const bad = r.stars <= 2 && !r.followed_up;
          return (
            <View key={r.id} style={{ padding: 12, borderRadius: R.md, backgroundColor: bad ? '#F7DCD6' : C.cream, gap: 6 }}>
              <Row gap={8}>
                <Stars value={r.stars} size={14} />
                <Text style={{ fontWeight: '900', color: C.ink }}>{r.employee_name || L('Sin asignar', 'Unassigned')}</Text>
                <Text style={{ color: C.muted, flexShrink: 1 }} numberOfLines={1}>
                  {[r.orders?.folio, r.orders?.cliente_nombre, what(r)].filter(Boolean).join(' · ')}
                </Text>
              </Row>
              {r.tags.length || r.comment ? <Text style={{ color: C.ink }}>{[r.tags.join(', '), r.comment].filter(Boolean).join(' — ')}</Text> : null}
              <P small muted>{timeAgo(r.created_at, lang)}{!storeId ? ' · ' + sName(r.store_id) : ''}{r.followed_up && r.stars <= 2 ? ' · ' + L('Seguimiento hecho por ', 'Followed up by ') + (r.followed_by || '—') : ''}</P>
              {bad ? <Btn small kind="ghost" title={L('Marcar seguimiento hecho', 'Mark followed up')} onPress={() => follow(r)} style={{ alignSelf: 'flex-start' }} /> : null}
            </View>
          );
        })}
      </Card>
    </>
  );
}
