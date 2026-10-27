import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/Text';

import { Btn, Empty, H1, IcoBox, Loading, Note, P, Pills, Row, Screen, TopBar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cartCount, useCart } from '@/lib/cart';
import { modOn, pickOpen, prodFrom, prodName, prodStock, storeOptions, useFamilies, useProducts, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, R } from '@/lib/theme';

export default function Productos() {
  const { L, nm } = useLang();
  const { profile } = useAuth();
  const { data: stores } = useStores();
  const { data: fams } = useFamilies();
  const cart = useCart();
  const shopStores = (stores || []).filter((st) => st.activo && modOn(st, 'shop'));
  const [storeId, setStoreId] = useState<string | null>(null);
  const [fam, setFam] = useState('all');
  const [brand, setBrand] = useState('all');
  const [q, setQ] = useState('');
  // Desde Inicio: "Celulares" abre con su filtro y "Tienda" con todo
  const params = useLocalSearchParams<{ fam?: string }>();
  useEffect(() => {
    if (!params.fam) return;
    setFam(params.fam);
    setBrand('all');
    setQ('');
    router.setParams({ fam: undefined });
  }, [params.fam]);
  // Tocar la pestaña Tienda de abajo regresa a "Todo"
  const navigation = useNavigation();
  useEffect(() => {
    const off = (navigation as unknown as { addListener: (e: string, cb: () => void) => () => void }).addListener('tabPress', () => {
      setFam('all');
      setBrand('all');
    });
    return off;
  }, [navigation]);
  useEffect(() => {
    if (!storeId && shopStores.length) setStoreId(pickOpen(shopStores, profile?.store_id));
  }, [shopStores.length, storeId, profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: products, loading } = useProducts(storeId);
  const st = shopStores.find((x) => x.id === storeId);

  if (!stores || !fams) return <Loading />;
  if (!shopStores.length) {
    return (
      <Screen wall="shop">
        <TopBar />
        <H1>{L('Tienda', 'Shop')}</H1>
        <Empty>{L('Por ahora ninguna tienda vende productos por la app.', 'No store sells products in the app right now.')}</Empty>
      </Screen>
    );
  }

  const visible = (products || []).filter((p) => p.activo && p.product_variants.some((v) => v.activo));
  const famsUsed = fams.filter((f) => visible.some((p) => p.family_id === f.id));
  const inFam = visible.filter((p) => fam === 'all' || p.family_id === fam);
  const brands = [...new Set(inFam.map((p) => p.marca).filter(Boolean))];
  const qq = q.trim().toLowerCase();
  const list = inFam.filter((p) => (brand === 'all' || p.marca === brand) && (!qq || `${p.marca} ${p.modelo} ${p.compat}`.toLowerCase().includes(qq)));
  const n = cartCount(cart);

  return (
    <Screen
      wall="shop"
      footer={
        n > 0 ? (
          <Btn icon="cart" title={L(`Ver carrito (${n})`, `View cart (${n})`)} onPress={() => router.push('/carrito')} />
        ) : undefined
      }
    >
      <TopBar />
      <H1>{L('Tienda', 'Shop')}</H1>
      <Pills options={storeOptions(shopStores, L('Cerrada', 'Closed'))} value={storeId} onChange={(v) => { setStoreId(v); setBrand('all'); }} />
      {st && st.abierta === false ? <Note kind="red" icon="clock">{st.aviso_cerrada || L('Esta tienda está cerrada. Puedes ver sus productos, pero no comprar ahorita.', "This store is closed. You can browse, but can't buy right now.")}</Note> : null}
      <TextInput
        accessibilityLabel={L('Buscar', 'Search')}
        value={q}
        onChangeText={setQ}
        placeholder={L('Busca marca, modelo o "funda A15"', 'Search brand, model or "A15 case"')}
        placeholderTextColor="#93A5BD"
        style={{ minHeight: 48, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 18, fontSize: 16, color: C.ink }}
      />
      <Pills options={[{ v: 'all', label: L('Todo', 'All') }, ...famsUsed.map((f) => ({ v: f.id, label: nm(f), icon: f.icon }))]} value={fam} onChange={(v) => { setFam(v); setBrand('all'); }} />
      {brands.length > 1 ? <Pills options={[{ v: 'all', label: L('Todas las marcas', 'All brands') }, ...brands.map((b) => ({ v: b, label: b }))]} value={brand} onChange={setBrand} /> : null}
      {loading ? <Loading /> : null}
      {!loading && list.length === 0 ? <Empty>{L('No encontramos productos con esa búsqueda.', 'No products match your search.')}</Empty> : null}
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        {list.map((p) => {
          const stock = prodStock(p);
          const famIcon = fams.find((f) => f.id === p.family_id)?.icon || 'bag';
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/producto/[id]', params: { id: p.id } })}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, maxWidth: 270, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 12, gap: 8, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ height: 110, borderRadius: R.md, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.foto_url ? <Image source={{ uri: p.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <IcoBox n={famIcon} size={56} />}
              </View>
              <Text style={{ fontWeight: '900', color: C.ink }} numberOfLines={2}>{prodName(p)}</Text>
              <Text style={{ fontWeight: '900', color: C.brownDark }}>{L('Desde ', 'From ') + money(prodFrom(p))}</Text>
              <P small muted>{stock > 0 ? L(`${stock} disponibles`, `${stock} in stock`) : L('Agotado', 'Sold out')}</P>
            </Pressable>
          );
        })}
      </Row>
    </Screen>
  );
}
