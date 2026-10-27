import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { PanelHeader, usePanelStore } from '@/components/panel';
import { Btn, Card, Empty, Field, H2, IcoBox, Icon, Loading, Note, P, Pills, Row, Screen, Toggle } from '@/components/ui';
import { modOn, prodName, useFamilies, useProducts, useStores } from '@/lib/data';
import { digits, money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Product, Variant } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

type VDraft = Omit<Variant, 'id' | 'product_id'> & { id?: string; _del?: boolean };

export default function TiendaProductos() {
  const { L, nm } = useLang();
  const { data: stores, reload: reloadStores } = useStores();
  const { data: fams } = useFamilies();
  const st = usePanelStore(stores);
  const { data: products, reload } = useProducts(st?.id);
  const [fam, setFam] = useState('all');
  const [edit, setEdit] = useState<string | null>(null);
  const [err, setErr] = useState('');

  if (!stores || !fams) return <Loading />;

  const toggleProduct = async (p: Product, v: boolean) => {
    setErr('');
    const { error } = await supabase.from('products').update({ activo: v }).eq('id', p.id);
    if (error) setErr(errMsg(error));
    reload();
  };

  const addProduct = async () => {
    if (!st) return;
    setErr('');
    const { data, error } = await supabase
      .from('products')
      .insert({ store_id: st.id, family_id: fam === 'all' ? fams[0].id : fam, marca: '', modelo: L('Producto nuevo', 'New product'), activo: false, orden: (products?.length || 0) + 1 })
      .select('id')
      .single();
    if (error) {
      setErr(errMsg(error));
      return;
    }
    await supabase.from('product_variants').insert({ product_id: data.id, label: L('Estándar', 'Standard'), price: 0, stock: 0 });
    await reload();
    setEdit(data.id);
  };

  const list = (products || []).filter((p) => fam === 'all' || p.family_id === fam);
  const onCount = (products || []).filter((p) => p.activo).length;

  return (
    <Screen wide>
      <PanelHeader kind="tienda" store={st} stores={stores} onStoreChange={reloadStores} />
      {st && !modOn(st, 'shop') ? (
        <Note kind="gold" icon="bag">{L('La venta de productos está apagada para esta tienda (Mi tienda → ¿Qué ofrece?). Los clientes no ven estos productos.', 'Product sales are off for this store (My store → What does it offer?). Customers do not see these products.')}</Note>
      ) : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <P muted style={{ flex: 1 }}>
          {L(`${onCount} de ${products?.length || 0} productos prendidos. Lo que apagues deja de verse en la app al momento.`, `${onCount} of ${products?.length || 0} products on. What you turn off disappears from the app right away.`)}
        </P>
        <Btn icon="bag" title={L('Agregar producto', 'Add product')} onPress={addProduct} />
      </Row>
      <Pills options={[{ v: 'all', label: L('Todo', 'All') }, ...fams.map((f) => ({ v: f.id, label: nm(f), icon: f.icon }))]} value={fam} onChange={setFam} />
      {err ? <Note kind="red">{err}</Note> : null}
      {!products ? <Loading /> : null}
      {products && list.length === 0 ? <Empty>{L('No hay productos en esta familia.', 'No products in this family.')}</Empty> : null}
      {list.map((p) =>
        edit === p.id ? (
          <ProductEditor key={p.id} p={p} storeId={st!.id} onDone={() => { setEdit(null); reload(); }} />
        ) : (
          <Card key={p.id} style={{ opacity: p.activo ? 1 : 0.75 }}>
            <Row gap={12} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <View style={{ width: 64, height: 64, borderRadius: R.md, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.foto_url ? <Image source={{ uri: p.foto_url }} style={{ width: 64, height: 64 }} /> : <IcoBox n={fams.find((f) => f.id === p.family_id)?.icon || 'bag'} size={40} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{prodName(p)}</Text>
                <P small muted>{nm(fams.find((f) => f.id === p.family_id))}{p.compat ? ' · ' + L('para ', 'for ') + p.compat : ''}</P>
                <Row gap={6}>
                  {p.product_variants.sort((a, b) => a.orden - b.orden).map((v) => (
                    <View key={v.id} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: v.activo ? (v.stock > 0 ? C.blueSoft : C.redSoft) : C.line }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: v.activo ? (v.stock > 0 ? C.blueInk : C.red) : C.muted }}>
                        {v.label} · {money(v.price)} · {v.activo ? (v.stock > 0 ? L(`${v.stock} pzs`, `${v.stock} pcs`) : L('agotado', 'sold out')) : L('apagado', 'off')}
                      </Text>
                    </View>
                  ))}
                </Row>
              </View>
              <View style={{ gap: 8, alignItems: 'flex-end' }}>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: p.activo }} accessibilityLabel={L('Prender o apagar ', 'Turn on or off ') + prodName(p)} onPress={() => toggleProduct(p, !p.activo)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, minHeight: 36, borderRadius: R.pill, backgroundColor: p.activo ? '#DDF1E4' : C.line }}>
                  <View style={{ width: 38, height: 22, borderRadius: 11, padding: 3, backgroundColor: p.activo ? '#2E8B57' : '#93A5BD' }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', transform: [{ translateX: p.activo ? 16 : 0 }] }} />
                  </View>
                  <Text style={{ fontWeight: '900', color: p.activo ? '#1E5B35' : C.muted }}>{p.activo ? L('Prendido', 'On') : L('Apagado', 'Off')}</Text>
                </Pressable>
                <Btn small kind="ghost" icon="edit" title={L('Editar', 'Edit')} onPress={() => setEdit(p.id)} />
              </View>
            </Row>
          </Card>
        ),
      )}
    </Screen>
  );
}

function ProductEditor({ p, storeId, onDone }: { p: Product; storeId: string; onDone: () => void }) {
  const { L, nm } = useLang();
  const { data: fams } = useFamilies();
  const [f, setF] = useState({ family_id: p.family_id, marca: p.marca, modelo: p.modelo, descripcion: p.descripcion, compat: p.compat, foto_url: p.foto_url, activo: p.activo });
  const [vs, setVs] = useState<VDraft[]>(p.product_variants.slice().sort((a, b) => a.orden - b.orden).map((v) => ({ ...v })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [delArmed, setDelArmed] = useState(false);
  const setV = (i: number, patch: Partial<VDraft>) => setVs((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const photo = async () => {
    const img = await pickImage();
    if (!img) return;
    try {
      const path = await uploadImage('publico', storeId, img);
      const { data } = supabase.storage.from('publico').getPublicUrl(path);
      setF((x) => ({ ...x, foto_url: data.publicUrl }));
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const save = async () => {
    setErr('');
    if (!f.modelo.trim()) return setErr(L('Escribe el modelo o nombre del producto.', 'Enter the model or product name.'));
    const live = vs.filter((v) => !v._del);
    if (!live.length) return setErr(L('Deja al menos una variante.', 'Keep at least one variant.'));
    if (live.some((v) => !(Number(v.price) > 0))) return setErr(L('Cada variante necesita un precio mayor a 0.', 'Each variant needs a price above 0.'));
    setBusy(true);
    const { error } = await supabase.from('products').update({ ...f, marca: f.marca.trim(), modelo: f.modelo.trim() }).eq('id', p.id);
    if (error) {
      setBusy(false);
      return setErr(errMsg(error));
    }
    for (const [i, v] of vs.entries()) {
      const row = { label: v.label.trim() || L('Estándar', 'Standard'), price: Number(v.price) || 0, stock: Math.max(0, Number(v.stock) || 0), activo: v.activo, orden: i + 1 };
      const r = v._del
        ? v.id ? await supabase.from('product_variants').delete().eq('id', v.id) : { error: null }
        : v.id ? await supabase.from('product_variants').update(row).eq('id', v.id) : await supabase.from('product_variants').insert({ ...row, product_id: p.id });
      if (r.error) {
        setBusy(false);
        return setErr(errMsg(r.error));
      }
    }
    setBusy(false);
    onDone();
  };

  const remove = async () => {
    if (!delArmed) return setDelArmed(true);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) setErr(errMsg(error));
    else onDone();
  };

  return (
    <Card style={{ borderColor: C.gold, borderWidth: 2 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{L('Editar producto', 'Edit product')}</H2>
        <Toggle label={f.activo ? L('Prendido: se ve en la app', 'On: visible in the app') : L('Apagado: no se ve', 'Off: hidden')} value={f.activo} onChange={(v) => setF((x) => ({ ...x, activo: v }))} />
      </Row>
      <Row gap={12} style={{ alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={photo} style={{ width: 96, height: 96, borderRadius: R.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {f.foto_url ? <Image source={{ uri: f.foto_url }} style={{ width: 96, height: 96 }} /> : <Icon n="camera" size={28} color={C.brown} />}
        </Pressable>
        <P small muted style={{ flex: 1 }}>{L('Toca para subir una foto del producto (opcional).', 'Tap to upload a product photo (optional).')}</P>
      </Row>
      {fams ? <Pills label={L('Familia', 'Family')} options={fams.map((x) => ({ v: x.id, label: nm(x), icon: x.icon }))} value={f.family_id} onChange={(v) => setF((x) => ({ ...x, family_id: v }))} /> : null}
      <Row style={{ alignItems: 'flex-start' }}>
        <Field label={L('Marca', 'Brand')} value={f.marca} onChangeText={(v) => setF((x) => ({ ...x, marca: v }))} />
        <Field label={L('Modelo o nombre', 'Model or name')} value={f.modelo} onChangeText={(v) => setF((x) => ({ ...x, modelo: v }))} />
      </Row>
      <Field label={L('Descripción', 'Description')} value={f.descripcion} onChangeText={(v) => setF((x) => ({ ...x, descripcion: v }))} />
      <Field label={L('Compatible con (para accesorios)', 'Works with (for accessories)')} value={f.compat} onChangeText={(v) => setF((x) => ({ ...x, compat: v }))} placeholder="Galaxy A15, Moto G54" />

      <H2>{L('Variantes, precio y existencias', 'Variants, price and stock')}</H2>
      {vs.map((v, i) =>
        v._del ? null : (
          <Row key={v.id || 'n' + i} style={{ alignItems: 'flex-end', padding: 10, borderRadius: R.md, backgroundColor: C.cream }}>
            <Field label={L('Variante (color, capacidad…)', 'Variant (color, storage…)')} value={v.label} onChangeText={(x) => setV(i, { label: x })} />
            <Field label={L('Precio (USD)', 'Price (USD)')} value={String(v.price)} onChangeText={(x) => setV(i, { price: x.replace(/[^0-9.]/g, '') as unknown as number })} keyboardType="decimal-pad" style={{ maxWidth: 140 }} />
            <Field label={L('Existencias', 'Stock')} value={String(v.stock)} onChangeText={(x) => setV(i, { stock: digits(x) as unknown as number })} keyboardType="number-pad" style={{ maxWidth: 120 }} />
            <Toggle label={v.activo ? L('Prendida', 'On') : L('Apagada', 'Off')} value={v.activo} onChange={(x) => setV(i, { activo: x })} />
            <Btn small kind="danger" title={L('Quitar', 'Remove')} onPress={() => setV(i, { _del: true })} />
          </Row>
        ),
      )}
      <Btn small kind="ghost" title={'+ ' + L('Agregar variante', 'Add variant')} style={{ alignSelf: 'flex-start' }}
        onPress={() => setVs((arr) => [...arr, { label: '', price: Number(arr[0]?.price) || 0, stock: 0, activo: true, orden: arr.length + 1 }])} />
      {err ? <Note kind="red">{err}</Note> : null}
      <Row>
        <Btn title={L('Guardar', 'Save')} onPress={save} loading={busy} />
        <Btn kind="ghost" title={L('Cancelar', 'Cancel')} onPress={onDone} />
        <Btn kind="danger" title={delArmed ? L('¿Seguro? Toca otra vez', 'Sure? Tap again') : L('Borrar producto', 'Delete product')} onPress={remove} />
      </Row>
    </Card>
  );
}
