import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Btn, Card, Field, H2, Loading, Note, P, Row, Screen, Toggle } from '@/components/ui';
import { useCategories, useSettings } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { ID_TYPES } from '@/lib/idtypes';
import { DEFAULT_CREDIT } from '@/lib/plans';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Category, CreditCfg } from '@/lib/types';

type CatDraft = Category & { _new?: boolean };

export default function AdminReglas() {
  const { L, lang } = useLang();
  const { data: cfg, reload } = useSettings();
  const { data: cats, reload: reloadCats } = useCategories();
  const [cr, setCr] = useState<CreditCfg>(DEFAULT_CREDIT);
  const [ids, setIds] = useState<Record<string, boolean>>({});
  const [redes, setRedes] = useState('');
  const [list, setList] = useState<CatDraft[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!cfg) return;
    setCr({ ...DEFAULT_CREDIT, ...(cfg.credit || {}), freqs: { ...DEFAULT_CREDIT.freqs, ...(cfg.credit?.freqs || {}) } });
    setIds(cfg.id_types || {});
    setRedes(cfg.redes || '');
  }, [cfg]);
  useEffect(() => {
    if (cats) setList(cats.map((c) => ({ ...c })));
  }, [cats]);

  if (!cfg || !cats) return <Loading />;
  const num = (v: string) => v.replace(/[^0-9.]/g, '');
  const setC = (p: Partial<CreditCfg>) => setCr((x) => ({ ...x, ...p }));
  const done = (ok: string, error: unknown) => {
    setBusy('');
    if (error) setErr(errMsg(error));
    else setMsg(ok);
  };

  const saveRules = async () => {
    setBusy('rules');
    setErr('');
    setMsg('');
    const credit = { ...cr, minDown: Number(cr.minDown) || 0, rate: Number(cr.rate) || 0, lateFee: Number(cr.lateFee) || 0, grace: Number(cr.grace) || 0, minPrice: Number(cr.minPrice) || 0, layDays: Number(cr.layDays) || 0 };
    const { error } = await supabase.from('settings').update({ credit, id_types: ids, redes }).eq('id', 1);
    done(L('Reglas guardadas', 'Rules saved'), error);
    reload();
  };

  const saveCats = async () => {
    setBusy('cats');
    setErr('');
    setMsg('');
    const bad = list.find((c) => !c.es.trim() || !c.id.trim());
    if (bad) return done('', new Error(L('Cada categoría necesita clave y nombre en español', 'Each category needs a key and a Spanish name')));
    const rows = list.map((c, i) => ({ id: c.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''), es: c.es.trim(), en: c.en.trim() || c.es.trim(), icon: c.icon || 'tool', orden: i + 1 }));
    const { error } = await supabase.from('service_categories').upsert(rows);
    done(L('Categorías guardadas', 'Categories saved'), error);
    reloadCats();
  };

  const delCat = async (c: CatDraft) => {
    if (c._new) return setList((l) => l.filter((x) => x !== c));
    setBusy('del' + c.id);
    setErr('');
    setMsg('');
    const { count } = await supabase.from('services').select('id', { count: 'exact', head: true }).eq('cat_id', c.id);
    if (count) return done('', new Error(L(`Esta categoría tiene ${count} servicio(s). Muévelos a otra antes de borrarla.`, `This category has ${count} service(s). Move them first.`)));
    const { error } = await supabase.from('service_categories').delete().eq('id', c.id);
    done(L('Categoría borrada', 'Category deleted'), error);
    reloadCats();
  };

  const move = (i: number, d: number) =>
    setList((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = l.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Screen wide>
      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}

      <Card>
        <H2>{L('Categorías de servicios', 'Service categories')}</H2>
        <P small muted>{L('Agrupan los servicios en la pantalla del cliente. Usa las flechas para cambiar el orden.', 'They group services on the customer screen. Use the arrows to reorder.')}</P>
        {list.map((c, i) => (
          <View key={c._new ? 'n' + i : c.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Row style={{ alignItems: 'flex-end' }}>
              <Field label={L('Clave', 'Key')} value={c.id} onChangeText={(v) => c._new && setList((l) => l.map((x) => (x === c ? { ...x, id: v } : x)))} style={{ maxWidth: 140 }} autoCapitalize="none" />
              <Field label={L('Nombre (español)', 'Name (Spanish)')} value={c.es} onChangeText={(v) => setList((l) => l.map((x) => (x === c ? { ...x, es: v } : x)))} />
              <Field label={L('Nombre (inglés)', 'Name (English)')} value={c.en} onChangeText={(v) => setList((l) => l.map((x) => (x === c ? { ...x, en: v } : x)))} />
              <Field label={L('Ícono', 'Icon')} value={c.icon} onChangeText={(v) => setList((l) => l.map((x) => (x === c ? { ...x, icon: v } : x)))} style={{ maxWidth: 120 }} autoCapitalize="none" />
            </Row>
            <Row>
              <Btn small kind="ghost" title="↑" onPress={() => move(i, -1)} />
              <Btn small kind="ghost" title="↓" onPress={() => move(i, 1)} />
              <Btn small kind="danger" title={L('Borrar', 'Delete')} loading={busy === 'del' + c.id} onPress={() => delCat(c)} />
            </Row>
          </View>
        ))}
        <Row>
          <Btn small kind="ghost" icon="plus" title={L('Agregar categoría', 'Add category')} onPress={() => setList((l) => [...l, { id: '', es: '', en: '', icon: 'tool', orden: l.length + 1, _new: true }])} />
          <Btn small icon="check" title={L('Guardar categorías', 'Save categories')} loading={busy === 'cats'} onPress={saveCats} />
        </Row>
      </Card>

      <Card>
        <H2>{L('Crédito y apartado', 'Credit & layaway')}</H2>
        <P small muted>{L('Reglas generales para todas las tiendas. Cada tienda decide si ofrece crédito o apartado en "Mi tienda" y a quién le da línea.', 'General rules for all stores. Each store decides whether it offers credit or layaway in "My store" and who gets a line.')}</P>
        <Row style={{ flexWrap: 'wrap' }}>
          <Toggle label={L('Crédito disponible', 'Credit available')} value={!!cr.on} onChange={(v) => setC({ on: v })} />
          <Toggle label={L('Apartado disponible', 'Layaway available')} value={!!cr.layaway} onChange={(v) => setC({ layaway: v })} />
        </Row>
        <P small style={{ fontWeight: '800' }}>{L('Frecuencias de pago', 'Payment frequencies')}</P>
        <Row style={{ flexWrap: 'wrap' }}>
          {(['semanal', 'quincenal', 'mensual'] as const).map((k) => (
            <Toggle key={k} label={{ semanal: L('Semanal', 'Weekly'), quincenal: L('Quincenal', 'Biweekly'), mensual: L('Mensual', 'Monthly') }[k]} value={!!cr.freqs[k]} onChange={(v) => setC({ freqs: { ...cr.freqs, [k]: v } })} />
          ))}
        </Row>
        <Row style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Field label={L('Número de pagos permitidos', 'Allowed number of payments')} value={cr.nList} onChangeText={(v) => setC({ nList: v.replace(/[^0-9, ]/g, '') })} placeholder="4, 6, 8, 12" />
          <Field label={L('Enganche mínimo (%)', 'Minimum down (%)')} value={String(cr.minDown)} onChangeText={(v) => setC({ minDown: num(v) as unknown as number })} keyboardType="decimal-pad" />
          <Field label={L('Recargo por financiar (%)', 'Financing charge (%)')} value={String(cr.rate)} onChangeText={(v) => setC({ rate: num(v) as unknown as number })} keyboardType="decimal-pad" />
          <Field label={L('Precio mínimo del artículo (USD)', 'Minimum item price (USD)')} value={String(cr.minPrice)} onChangeText={(v) => setC({ minPrice: num(v) as unknown as number })} keyboardType="decimal-pad" />
          <Field label={L('Cargo por atraso (USD)', 'Late fee (USD)')} value={String(cr.lateFee)} onChangeText={(v) => setC({ lateFee: num(v) as unknown as number })} keyboardType="decimal-pad" />
          <Field label={L('Días de gracia', 'Grace days')} value={String(cr.grace)} onChangeText={(v) => setC({ grace: num(v) as unknown as number })} keyboardType="number-pad" />
          <Field label={L('Plazo máximo de apartado (días)', 'Max layaway term (days)')} value={String(cr.layDays)} onChangeText={(v) => setC({ layDays: num(v) as unknown as number })} keyboardType="number-pad" />
        </Row>
        <Note kind="gold" icon="shield">{L('Si cobras recargos o intereses, revisa las leyes de crédito al consumidor de tu estado (tasa máxima y avisos por escrito).', 'If you charge fees or interest, check your state consumer credit laws (maximum rate and written disclosures).')}</Note>
      </Card>

      <Card>
        <H2>{L('Identificaciones aceptadas', 'Accepted IDs')}</H2>
        <P small muted>{L('Las que el cliente puede subir para subir su límite de envío.', 'Those customers can upload to raise their transfer limit.')}</P>
        <Row style={{ flexWrap: 'wrap' }}>
          {ID_TYPES.map(([k, es, en]) => (
            <Toggle key={k} icon="id" label={lang === 'es' ? es : en} value={ids[k] !== false} onChange={(v) => setIds((x) => ({ ...x, [k]: v }))} />
          ))}
        </Row>
      </Card>

      <Card>
        <H2>{L('Redes de retiro en efectivo', 'Cash pickup networks')}</H2>
        <Field label={L('Separadas por comas', 'Comma-separated')} value={redes} onChangeText={setRedes} placeholder="Elektra, Coppel, OXXO" />
        <P small muted>{L('Aparecen cuando el cliente registra a una persona que recoge en efectivo.', 'Shown when a customer adds a person who picks up cash.')}</P>
      </Card>

      <Btn title={L('Guardar reglas', 'Save rules')} icon="check" loading={busy === 'rules'} onPress={saveRules} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}
