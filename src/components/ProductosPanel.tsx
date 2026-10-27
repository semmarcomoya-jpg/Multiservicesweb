/** Alta y edición de productos de una tienda: datos, fotos, especificaciones, ficha técnica, variantes y existencias. */
import React, { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { setAdminStore, usePanelStore } from '@/components/panel';
import { Text } from '@/components/Text';
import { Btn, Card, Empty, Field, H2, IcoBox, Icon, Loading, matches, Note, P, Pills, Row, Screen, SearchBox, Toggle } from '@/components/ui';
import { modOn, prodName, storeShort, useFamilies, useProducts, useStores } from '@/lib/data';
import { digits, money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { uploadDoc } from '@/lib/pickFile';
import { cleanSpecs, type Spec, templateFor } from '@/lib/specs';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Product, Variant } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

type VDraft = Omit<Variant, 'id' | 'product_id'> & { id?: string; _del?: boolean };

export function ProductosPanel({ admin }: { admin?: boolean }) {
  const { L, nm } = useLang();
  const { data: stores } = useStores();
  const { data: fams } = useFamilies();
  const st = usePanelStore(stores);
  const { data: products, reload } = useProducts(st?.id);
  const [fam, setFam] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null); // id del producto, o 'new'
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  if (!stores || !fams) return <Loading />;
  if (!st) return <Screen wide><Empty>{L('Esta cuenta no tiene tienda asignada.', 'This account has no store assigned.')}</Empty></Screen>;

  const toggleProduct = async (p: Product, v: boolean) => {
    setErr('');
    const { error } = await supabase.from('products').update({ activo: v }).eq('id', p.id);
    if (error) setErr(errMsg(error));
    reload();
  };

  const list = (products || []).filter((p) => (fam === 'all' || p.family_id === fam) && matches(q, p.marca, p.modelo, p.compat, p.descripcion, p.product_variants.map((v) => v.label).join(' ')));
  const onCount = (products || []).filter((p) => p.activo).length;
  const editing = edit === 'new' ? null : (products || []).find((p) => p.id === edit);
  const done = (m?: string) => {
    setEdit(null);
    setMsg(m || '');
    reload();
  };

  return (
    <Screen wide>
      {admin ? (
        <Card>
          <Pills label={L('¿De qué tienda?', 'Which store?')} options={stores.map((s) => ({ v: s.id, label: storeShort(s), icon: 'store' }))} value={st.id} onChange={(v) => { setAdminStore(v); setEdit(null); }} />
          <P small muted>{L('Cada tienda tiene su propio catálogo, precios y existencias.', 'Each store has its own catalog, prices and stock.')}</P>
        </Card>
      ) : null}
      {!modOn(st, 'shop') ? (
        <Note kind="gold" icon="bag">{L('La venta de productos está apagada para esta tienda (Mi tienda → ¿Qué ofrece?). Los clientes no ven estos productos.', 'Product sales are off for this store (My store → What does it offer?). Customers do not see these products.')}</Note>
      ) : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}

      {edit ? (
        <ProductEditor key={edit} p={editing || null} storeId={st.id} defaultFam={fam === 'all' ? fams[0].id : fam} onDone={done} />
      ) : (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <P muted style={{ flex: 1, minWidth: 200 }}>
              {L(`${onCount} de ${products?.length || 0} productos prendidos en ${storeShort(st)}. Lo que apagues deja de verse en la app al momento.`, `${onCount} of ${products?.length || 0} products on at ${storeShort(st)}. What you turn off disappears from the app right away.`)}
            </P>
            <Btn icon="plus" title={L('Dar de alta un producto', 'Add a product')} onPress={() => { setMsg(''); setEdit('new'); }} />
          </Row>
          <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca marca, modelo o variante', 'Search brand, model or variant')} count={q ? list.length : undefined} />
          <Pills options={[{ v: 'all', label: L('Todo', 'All') }, ...fams.map((f) => ({ v: f.id, label: nm(f), icon: f.icon }))]} value={fam} onChange={setFam} />
          {err ? <Note kind="red">{err}</Note> : null}
          {!products ? <Loading /> : null}
          {products && list.length === 0 ? <Empty>{L('No hay productos aquí. Toca "Dar de alta un producto".', 'No products here. Tap "Add a product".')}</Empty> : null}
          {list.map((p) => (
            <Card key={p.id} style={{ opacity: p.activo ? 1 : 0.75 }}>
              <Row gap={12} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <View style={{ width: 64, height: 64, borderRadius: R.md, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {p.foto_url ? <Image source={{ uri: p.foto_url }} style={{ width: 64, height: 64 }} resizeMode="contain" /> : <IcoBox n={fams.find((f) => f.id === p.family_id)?.icon || 'bag'} size={40} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{prodName(p)}</Text>
                  <P small muted>
                    {nm(fams.find((f) => f.id === p.family_id))}
                    {p.compat ? ' · ' + L('para ', 'for ') + p.compat : ''}
                    {cleanSpecs(p.specs).length ? ' · ' + L(`${cleanSpecs(p.specs).length} especificaciones`, `${cleanSpecs(p.specs).length} specs`) : ''}
                    {p.ficha_url ? ' · ' + L('con ficha técnica', 'with spec sheet') : ''}
                  </P>
                  <Row gap={6}>
                    {p.product_variants.slice().sort((a, b) => a.orden - b.orden).map((v) => (
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
                  <Btn small kind="ghost" icon="edit" title={L('Editar', 'Edit')} onPress={() => { setMsg(''); setEdit(p.id); }} />
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function ProductEditor({ p, storeId, defaultFam, onDone }: { p: Product | null; storeId: string; defaultFam: string; onDone: (msg?: string) => void }) {
  const { L, nm } = useLang();
  const { data: fams } = useFamilies();
  const [f, setF] = useState({
    family_id: p?.family_id || defaultFam,
    marca: p?.marca || '',
    modelo: p?.modelo || '',
    descripcion: p?.descripcion || '',
    compat: p?.compat || '',
    foto_url: p?.foto_url || null,
    fotos: p?.fotos || [],
    ficha_url: p?.ficha_url || null,
    ficha_name: p?.ficha_name || '',
    activo: p ? p.activo : true,
  });
  const initSpecs = (fam: string): Spec[] => templateFor(fam).map(([k]) => ({ k, v: '' }));
  const [specs, setSpecs] = useState<Spec[]>(p?.specs?.length ? p.specs.map((x) => ({ ...x })) : initSpecs(p?.family_id || defaultFam));
  const [vs, setVs] = useState<VDraft[]>(
    p ? p.product_variants.slice().sort((a, b) => a.orden - b.orden).map((v) => ({ ...v })) : [{ label: '', price: 0, stock: 1, activo: true, orden: 1 }],
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState('');
  const [delArmed, setDelArmed] = useState(false);
  const setV = (i: number, patch: Partial<VDraft>) => setVs((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setS = (i: number, patch: Partial<Spec>) => setSpecs((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const allPhotos = [f.foto_url, ...f.fotos].filter(Boolean) as string[];

  const addPhoto = async () => {
    setErr('');
    const img = await pickImage();
    if (!img) return;
    setUp('foto');
    try {
      const path = await uploadImage('publico', storeId, img);
      const url = supabase.storage.from('publico').getPublicUrl(path).data.publicUrl;
      setF((x) => (x.foto_url ? { ...x, fotos: [...x.fotos, url] } : { ...x, foto_url: url }));
    } catch (e) {
      setErr(errMsg(e));
    }
    setUp('');
  };
  const removePhoto = (u: string) => setF((x) => {
    const rest = [x.foto_url, ...x.fotos].filter((y) => y && y !== u) as string[];
    return { ...x, foto_url: rest[0] || null, fotos: rest.slice(1) };
  });
  const mainPhoto = (u: string) => setF((x) => {
    const rest = [x.foto_url, ...x.fotos].filter((y) => y && y !== u) as string[];
    return { ...x, foto_url: u, fotos: rest };
  });
  const addFicha = async () => {
    setErr('');
    setUp('ficha');
    try {
      const r = await uploadDoc(storeId);
      if (r) setF((x) => ({ ...x, ficha_url: r.url, ficha_name: r.name }));
    } catch (e) {
      setErr(errMsg(e));
    }
    setUp('');
  };
  const changeFam = (v: string) => {
    setF((x) => ({ ...x, family_id: v }));
    // Si aún no llenó nada, cambia los campos sugeridos a los de la nueva familia
    if (!specs.some((s) => s.v.trim())) setSpecs(initSpecs(v));
  };
  const addSuggested = () => {
    const have = new Set(specs.map((s) => s.k));
    setSpecs((arr) => [...arr, ...templateFor(f.family_id).filter(([k]) => !have.has(k)).map(([k]) => ({ k, v: '' }))]);
  };

  const save = async () => {
    setErr('');
    if (!f.modelo.trim()) return setErr(L('Escribe el modelo o nombre del producto.', 'Enter the model or product name.'));
    const live = vs.filter((v) => !v._del);
    if (!live.length) return setErr(L('Deja al menos una variante.', 'Keep at least one variant.'));
    if (live.some((v) => !(Number(v.price) > 0))) return setErr(L('Cada variante necesita un precio mayor a 0.', 'Each variant needs a price above 0.'));
    setBusy(true);
    const row = { ...f, marca: f.marca.trim(), modelo: f.modelo.trim(), specs: cleanSpecs(specs) };
    let pid = p?.id;
    if (pid) {
      const { error } = await supabase.from('products').update(row).eq('id', pid);
      if (error) {
        setBusy(false);
        return setErr(errMsg(error));
      }
    } else {
      const { data: cnt } = await supabase.from('products').select('id').eq('store_id', storeId);
      const { data, error } = await supabase.from('products').insert({ ...row, store_id: storeId, orden: (cnt?.length || 0) + 1 }).select('id').single();
      if (error || !data) {
        setBusy(false);
        return setErr(errMsg(error));
      }
      pid = data.id as string;
    }
    for (const [i, v] of vs.entries()) {
      const vr = { label: v.label.trim() || L('Estándar', 'Standard'), price: Number(v.price) || 0, stock: Math.max(0, Number(v.stock) || 0), activo: v.activo, orden: i + 1 };
      const r = v._del
        ? v.id ? await supabase.from('product_variants').delete().eq('id', v.id) : { error: null }
        : v.id ? await supabase.from('product_variants').update(vr).eq('id', v.id) : await supabase.from('product_variants').insert({ ...vr, product_id: pid });
      if (r.error) {
        setBusy(false);
        return setErr(errMsg(r.error));
      }
    }
    setBusy(false);
    onDone(p ? L('Producto guardado', 'Product saved') : L(`Listo, ${row.marca} ${row.modelo} ya está dado de alta`, `Done, ${row.marca} ${row.modelo} was added`));
  };

  const remove = async () => {
    if (!p) return onDone();
    if (!delArmed) return setDelArmed(true);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) setErr(errMsg(error));
    else onDone(L('Producto borrado', 'Product deleted'));
  };

  const isPdf = /\.pdf($|\?)/i.test(f.ficha_url || '');

  return (
    <>
      <Card style={{ borderColor: C.gold, borderWidth: 2 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>{p ? L('Editar producto', 'Edit product') : L('Nuevo producto', 'New product')}</H2>
          <Toggle label={f.activo ? L('Prendido: se ve en la app', 'On: visible in the app') : L('Apagado: no se ve', 'Off: hidden')} value={f.activo} onChange={(v) => setF((x) => ({ ...x, activo: v }))} />
        </Row>
        <P small muted>1 · {L('Datos generales', 'General info')}</P>
        {fams ? <Pills label={L('Familia', 'Family')} options={fams.map((x) => ({ v: x.id, label: nm(x), icon: x.icon }))} value={f.family_id} onChange={changeFam} /> : null}
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Marca', 'Brand')} value={f.marca} onChangeText={(v) => setF((x) => ({ ...x, marca: v }))} placeholder="Samsung" />
          <Field label={L('Modelo o nombre', 'Model or name')} value={f.modelo} onChangeText={(v) => setF((x) => ({ ...x, modelo: v }))} placeholder="Galaxy A15" />
        </Row>
        <Field label={L('Descripción corta', 'Short description')} value={f.descripcion} onChangeText={(v) => setF((x) => ({ ...x, descripcion: v }))} placeholder={L('Ej. Desbloqueado, ideal para WhatsApp y fotos', 'E.g. Unlocked, great for WhatsApp and photos')} />
        {f.family_id === 'acc' ? <Field label={L('Compatible con', 'Works with')} value={f.compat} onChangeText={(v) => setF((x) => ({ ...x, compat: v }))} placeholder="Galaxy A15, Moto G54" /> : null}
      </Card>

      <Card>
        <H2>2 · {L('Fotos', 'Photos')}</H2>
        <P small muted>{L('La primera es la principal. Cuadradas o verticales, fondo claro, 1000 × 1000 px. Hasta 6.', 'The first one is the main photo. Square or portrait, light background, 1000 × 1000 px. Up to 6.')}</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {allPhotos.map((u, i) => (
            <View key={u} style={{ width: 110, gap: 4 }}>
              <Image source={{ uri: u }} resizeMode="contain" style={{ width: 110, height: 110, borderRadius: 12, backgroundColor: C.tint, borderWidth: i === 0 ? 3 : 0, borderColor: C.brown }} />
              <Row gap={4} style={{ flexWrap: 'nowrap' }}>
                {i > 0 ? <Btn small kind="ghost" title={L('Principal', 'Main')} onPress={() => mainPhoto(u)} /> : <P small style={{ color: C.brown, fontWeight: '800' }}>{L('Principal', 'Main')}</P>}
                <Pressable accessibilityRole="button" accessibilityLabel={L('Quitar foto', 'Remove photo')} onPress={() => removePhoto(u)} style={{ padding: 6 }}>
                  <Icon n="x" size={18} color={C.red} />
                </Pressable>
              </Row>
            </View>
          ))}
          {allPhotos.length < 6 ? (
            <Pressable accessibilityRole="button" onPress={addPhoto} disabled={!!up}
              style={{ width: 110, height: 110, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line2, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon n="camera" size={24} color={C.brown} />
              <Text style={{ fontWeight: '800', color: C.brown, fontSize: 12 }}>{up === 'foto' ? L('Subiendo…', 'Uploading…') : L('Agregar foto', 'Add photo')}</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card>
        <H2>3 · {L('Especificaciones', 'Specifications')}</H2>
        <P small muted>{L('Solo llena el valor de cada dato. Los vacíos no se muestran al cliente. Puedes cambiar el nombre del dato o agregar otros.', 'Just fill in each value. Empty ones are not shown to customers. You can rename a field or add more.')}</P>
        {specs.map((s, i) => (
          <Row key={i} style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
            <Field label={i === 0 ? L('Dato', 'Field') : ''} value={s.k} onChangeText={(v) => setS(i, { k: v })} style={{ maxWidth: 200 }} />
            <Field label={i === 0 ? L('Valor', 'Value') : ''} value={s.v} onChangeText={(v) => setS(i, { v })} placeholder={L('Ej. 128 GB', 'E.g. 128 GB')} />
            <Pressable accessibilityRole="button" accessibilityLabel={L('Quitar dato', 'Remove field')} onPress={() => setSpecs((arr) => arr.filter((_, j) => j !== i))} style={{ padding: 10 }}>
              <Icon n="x" size={18} color={C.muted} />
            </Pressable>
          </Row>
        ))}
        <Row>
          <Btn small kind="ghost" icon="plus" title={L('Agregar dato', 'Add field')} onPress={() => setSpecs((arr) => [...arr, { k: '', v: '' }])} />
          <Btn small kind="ghost" title={L('Agregar los sugeridos', 'Add suggested fields')} onPress={addSuggested} />
        </Row>
      </Card>

      <Card>
        <H2>4 · {L('Ficha técnica (opcional)', 'Spec sheet (optional)')}</H2>
        <P small muted>{L('Sube el PDF del fabricante o una foto de la caja con las especificaciones completas (máx. 10 MB). El cliente la puede abrir desde el producto.', "Upload the manufacturer's PDF or a photo of the box with the full specs (max 10 MB). Customers can open it from the product.")}</P>
        {f.ficha_url ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, backgroundColor: C.blueSoft }}>
            {isPdf ? <IcoBox n="doc" size={44} /> : <Image source={{ uri: f.ficha_url }} style={{ width: 44, height: 44, borderRadius: 8 }} />}
            <Text style={{ flex: 1, fontWeight: '800', color: C.ink }} numberOfLines={1}>{f.ficha_name || L('Ficha técnica', 'Spec sheet')}</Text>
            <Btn small kind="ghost" title={L('Ver', 'View')} onPress={() => Linking.openURL(f.ficha_url!)} />
            <Btn small kind="ghost" title={L('Cambiar', 'Replace')} loading={up === 'ficha'} onPress={addFicha} />
            <Btn small kind="danger" title={L('Quitar', 'Remove')} onPress={() => setF((x) => ({ ...x, ficha_url: null, ficha_name: '' }))} />
          </View>
        ) : (
          <Btn kind="ghost" icon="upload" title={L('Subir ficha técnica (PDF o imagen)', 'Upload spec sheet (PDF or image)')} loading={up === 'ficha'} onPress={addFicha} style={{ alignSelf: 'flex-start' }} />
        )}
      </Card>

      <Card>
        <H2>5 · {L('Variantes, precio y existencias', 'Variants, price and stock')}</H2>
        <P small muted>{L('Una variante por cada color o capacidad que vendas, con su precio y cuántas piezas tienes.', 'One variant per color or capacity you sell, with its price and how many you have.')}</P>
        {vs.map((v, i) =>
          v._del ? null : (
            <Row key={v.id || 'n' + i} style={{ alignItems: 'flex-end', padding: 10, borderRadius: R.md, backgroundColor: C.cream }}>
              <Field label={L('Variante (color, capacidad…)', 'Variant (color, storage…)')} value={v.label} onChangeText={(x) => setV(i, { label: x })} placeholder={L('128 GB · Negro', '128 GB · Black')} />
              <Field label={L('Precio (USD)', 'Price (USD)')} value={String(v.price || '')} onChangeText={(x) => setV(i, { price: x.replace(/[^0-9.]/g, '') as unknown as number })} keyboardType="decimal-pad" style={{ maxWidth: 140 }} />
              <Field label={L('Existencias', 'Stock')} value={String(v.stock)} onChangeText={(x) => setV(i, { stock: digits(x) as unknown as number })} keyboardType="number-pad" style={{ maxWidth: 120 }} />
              <Toggle label={v.activo ? L('Prendida', 'On') : L('Apagada', 'Off')} value={v.activo} onChange={(x) => setV(i, { activo: x })} />
              <Btn small kind="danger" title={L('Quitar', 'Remove')} onPress={() => setV(i, { _del: true })} />
            </Row>
          ),
        )}
        <Btn small kind="ghost" icon="plus" title={L('Agregar variante', 'Add variant')} style={{ alignSelf: 'flex-start' }}
          onPress={() => setVs((arr) => [...arr, { label: '', price: Number(arr[0]?.price) || 0, stock: 0, activo: true, orden: arr.length + 1 }])} />
      </Card>

      {err ? <Note kind="red">{err}</Note> : null}
      <Row>
        <Btn icon="check" title={p ? L('Guardar cambios', 'Save changes') : L('Dar de alta', 'Add product')} onPress={save} loading={busy} />
        <Btn kind="ghost" title={L('Cancelar', 'Cancel')} onPress={() => onDone()} />
        {p ? <Btn kind="danger" title={delArmed ? L('¿Seguro? Toca otra vez', 'Sure? Tap again') : L('Borrar producto', 'Delete product')} onPress={remove} /> : null}
      </Row>
    </>
  );
}
