import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PanelHeader } from '@/components/panel';
import { Text, TextInput } from '@/components/Text';
import { Btn, Card, H2, IcoBox, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { prodFrom, prodName, svcCatIcon, useCategories, useProducts, useServices, useSettings, useStores } from '@/lib/data';
import { useFeaturedRows, useTopSellers } from '@/lib/featured';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Featured } from '@/lib/types';

type Kind = 'product' | 'service';

export default function AdminDestacados() {
  const { L, nm } = useLang();
  const { data: cfg, reload: reloadCfg } = useSettings();
  const { data: rows, reload } = useFeaturedRows();
  const [days, setDays] = useState(30);
  const { data: top } = useTopSellers(days, 12);
  const { data: products } = useProducts(null);
  const { data: services } = useServices();
  const { data: cats } = useCategories();
  const { data: stores } = useStores();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'all' | Kind>('all');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  if (!cfg || !rows || !products || !services || !stores) {
    return (
      <Screen wide>
        <Loading />
      </Screen>
    );
  }
  const modo = cfg.destacados_modo || 'auto';
  const storeShort = (id: string) => (stores.find((s) => s.id === id)?.nombre || '').replace('Castillo · ', '');

  const info = (kind: Kind, id: string) => {
    if (kind === 'product') {
      const p = products.find((x) => x.id === id);
      return p ? { title: prodName(p), sub: storeShort(p.store_id) + ' · ' + L('desde ', 'from ') + money(prodFrom(p)), icon: 'phone', ok: p.activo } : null;
    }
    const sv = services.find((x) => x.id === id);
    return sv ? { title: nm(sv), sub: L('Servicio', 'Service'), icon: svcCatIcon(cats || [], sv), ok: sv.activo } : null;
  };
  const chosen = new Set(rows.map((r) => r.kind + r.ref_id));

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(key);
    setErr('');
    const { error } = await fn();
    setBusy('');
    if (error) setErr(errMsg(error));
    reload();
  };
  const add = (kind: Kind, ref_id: string) => run('a' + ref_id, () => supabase.from('featured').insert({ kind, ref_id, orden: (rows.at(-1)?.orden || 0) + 1 }));
  const remove = (r: Featured) => run('d' + r.id, () => supabase.from('featured').delete().eq('id', r.id));
  const move = async (i: number, d: -1 | 1) => {
    const a = rows[i];
    const b = rows[i + d];
    if (!a || !b) return;
    setBusy('m' + a.id);
    await supabase.from('featured').update({ orden: b.orden === a.orden ? a.orden + d : b.orden }).eq('id', a.id);
    await supabase.from('featured').update({ orden: a.orden }).eq('id', b.id);
    setBusy('');
    reload();
  };
  const setModo = async (m: 'auto' | 'manual') => {
    const { error } = await supabase.from('settings').update({ destacados_modo: m }).eq('id', 1);
    if (error) setErr(errMsg(error));
    reloadCfg();
  };

  const qq = q.trim().toLowerCase();
  const catalog = [
    ...services.filter((s) => s.activo).map((s) => ({ kind: 'service' as Kind, id: s.id })),
    ...products.filter((p) => p.activo).map((p) => ({ kind: 'product' as Kind, id: p.id })),
  ]
    .filter((x) => tipo === 'all' || x.kind === tipo)
    .map((x) => ({ ...x, i: info(x.kind, x.id)! }))
    .filter((x) => x.i && (!qq || (x.i.title + ' ' + x.i.sub).toLowerCase().includes(qq)))
    .slice(0, 40);

  const ItemRow = ({ kind, id, right, extra }: { kind: Kind; id: string; right: React.ReactNode; extra?: string }) => {
    const i = info(kind, id);
    if (!i) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <IcoBox n={i.icon} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: '800', color: C.ink }} numberOfLines={1}>{i.title}</Text>
          <P small muted>{i.sub}{extra ? ' · ' + extra : ''}{i.ok ? '' : ' · ' + L('apagado', 'off')}</P>
        </View>
        {right}
      </View>
    );
  };

  return (
    <Screen wide>
      <P small muted>{L('Aparecen en Inicio, arriba, en la fila "Destacados". Las promociones siguen abajo de los accesos rápidos.', 'They appear at the top of Home in the "Featured" row. Promotions stay below the quick actions.')}</P>
      {err ? <Note kind="red">{err}</Note> : null}

      <Card>
        <H2>{L('¿Cómo se llenan?', 'How are they filled?')}</H2>
        <Pills
          options={[
            { v: 'auto', label: L('Automático: tus elegidos + lo más vendido', 'Automatic: your picks + best sellers') },
            { v: 'manual', label: L('Solo los que yo elija', 'Only my picks') },
          ]}
          value={modo}
          onChange={setModo}
        />
        <P small muted>
          {modo === 'auto'
            ? L('Primero salen los que tú elegiste y luego la app completa con lo que más se vende.', 'Your picks come first, then the app fills in with best sellers.')
            : L('Solo salen los que tú elegiste, en el orden que pongas.', 'Only your picks show, in your order.')}
        </P>
      </Card>

      <Row style={{ alignItems: 'flex-start' }}>
        <Card style={{ flexGrow: 1, flexBasis: 320 }}>
          <H2>{L('Tus destacados', 'Your picks')} ({rows.length})</H2>
          {rows.length === 0 ? <P muted>{L('Aún no eliges ninguno. Agrega de las sugerencias o del catálogo.', 'No picks yet. Add from suggestions or the catalog.')}</P> : null}
          {rows.map((r, i) => (
            <ItemRow
              key={r.id}
              kind={r.kind}
              id={r.ref_id}
              right={
                <Row gap={4} style={{ flexWrap: 'nowrap' }}>
                  <Btn small kind="ghost" title="↑" disabled={i === 0 || !!busy} onPress={() => move(i, -1)} />
                  <Btn small kind="ghost" title="↓" disabled={i === rows.length - 1 || !!busy} onPress={() => move(i, 1)} />
                  <Btn small kind="ghost" title={L('Quitar', 'Remove')} loading={busy === 'd' + r.id} onPress={() => remove(r)} />
                </Row>
              }
            />
          ))}
        </Card>

        <Card style={{ flexGrow: 1, flexBasis: 320 }}>
          <H2>{L('Sugerencias: lo más vendido', 'Suggestions: best sellers')}</H2>
          <Pills options={[{ v: 7, label: L('7 días', '7 days') }, { v: 30, label: L('30 días', '30 days') }, { v: 90, label: L('90 días', '90 days') }]} value={days} onChange={setDays} />
          {!top ? <Loading /> : null}
          {Array.isArray(top) && top.length === 0 ? <P muted>{L('Todavía no hay ventas en este periodo.', 'No sales in this period yet.')}</P> : null}
          {(Array.isArray(top) ? top : []).map((t, i) => (
            <ItemRow
              key={t.kind + t.ref_id}
              kind={t.kind}
              id={t.ref_id}
              extra={`#${i + 1} · ${t.veces} ${t.kind === 'product' ? L('vendidos', 'sold') : L('pedidos', 'orders')}`}
              right={chosen.has(t.kind + t.ref_id) ? <P small muted>{L('Ya está', 'Added')}</P> : <Btn small title={L('Agregar', 'Add')} loading={busy === 'a' + t.ref_id} onPress={() => add(t.kind, t.ref_id)} />}
            />
          ))}
        </Card>
      </Row>

      <Card>
        <H2>{L('Elegir del catálogo', 'Pick from the catalog')}</H2>
        <TextInput
          accessibilityLabel={L('Buscar', 'Search')}
          value={q}
          onChangeText={setQ}
          placeholder={L('Busca un producto o servicio', 'Search a product or service')}
          placeholderTextColor="#93A5BD"
          style={{ minHeight: 46, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 16, fontSize: 15, color: C.ink }}
        />
        <Pills options={[{ v: 'all', label: L('Todo', 'All') }, { v: 'service', label: L('Servicios', 'Services') }, { v: 'product', label: L('Productos', 'Products') }]} value={tipo} onChange={setTipo} />
        {catalog.map((x) => (
          <ItemRow
            key={x.kind + x.id}
            kind={x.kind}
            id={x.id}
            right={chosen.has(x.kind + x.id) ? <P small muted>{L('Ya está', 'Added')}</P> : <Btn small kind="ghost" title={L('Agregar', 'Add')} loading={busy === 'a' + x.id} onPress={() => add(x.kind, x.id)} />}
          />
        ))}
        {catalog.length === 0 ? <P muted>{L('Nada coincide con tu búsqueda.', 'Nothing matches your search.')}</P> : null}
        <Pressable onPress={() => setQ('')}>{qq ? <Text style={{ color: C.blue, fontWeight: '800' }}>{L('Limpiar búsqueda', 'Clear search')}</Text> : null}</Pressable>
      </Card>
    </Screen>
  );
}
