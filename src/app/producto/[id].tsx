import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { BackBar, Btn, Card, H1, IcoBox, Label, Loading, Note, P, Pills, Row, Screen } from '@/components/ui';
import { addToCart, cartCount, useCart } from '@/lib/cart';
import { modOn, prodName, useFamilies, useSettings, useStores } from '@/lib/data';
import { money } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Product } from '@/lib/types';

export default function ProductoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { L } = useLang();
  const { data: stores } = useStores();
  const { data: fams } = useFamilies();
  const { data: cfg } = useSettings();
  const credCfg = cfg?.credit || ({} as Partial<NonNullable<typeof cfg>['credit'] & object>);
  const cart = useCart();
  const [p, setP] = useState<Product | null>(null);
  const [vid, setVid] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [ask, setAsk] = useState(false);
  const [added, setAdded] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const pr = data as Product;
        if (!pr) {
          setMissing(true);
          return;
        }
        pr.product_variants = (pr.product_variants || []).filter((v) => v.activo).sort((a, b) => a.orden - b.orden);
        setP(pr);
        setVid((pr.product_variants.find((v) => v.stock > 0) || pr.product_variants[0])?.id ?? null);
      });
  }, [id]);

  if (missing)
    return (
      <Screen wall="shop">
        <BackBar />
        <Note kind="gold">{L('Este producto ya no está disponible.', 'This product is no longer available.')}</Note>
      </Screen>
    );
  if (!p || !stores) return <Loading />;
  const st = stores.find((x) => x.id === p.store_id);
  const v = p.product_variants.find((x) => x.id === vid);
  const closed = st?.abierta === false;
  const max = v ? Math.min(v.stock, 20) : 0;

  const add = (force = false) => {
    if (!v || !st) return;
    const ok = addToCart(st.id, { product_id: p.id, variant_id: v.id, name: prodName(p), label: v.label, qty, price: Number(v.price) }, force);
    if (!ok) {
      setAsk(true);
      return;
    }
    setAsk(false);
    setAdded(true);
  };

  return (
    <Screen
      wall="shop"
      footer={
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View>
            <P small muted>{L('Precio', 'Price')}</P>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{v ? money(Number(v.price) * qty) : '—'}</Text>
          </View>
          {added ? (
            <Btn icon="cart" title={L(`Ver carrito (${cartCount(cart)})`, `View cart (${cartCount(cart)})`)} onPress={() => router.push('/carrito')} />
          ) : (
            <Btn icon="cart" title={L('Agregar al carrito', 'Add to cart')} disabled={!v || v.stock < 1 || closed} onPress={() => add()} />
          )}
        </Row>
      }
    >
      <BackBar />
      <View style={{ height: 220, borderRadius: R.xl, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.foto_url ? <Image source={{ uri: p.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <IcoBox n={fams?.find((f) => f.id === p.family_id)?.icon || 'bag'} size={90} />}
      </View>
      <View style={{ gap: 4 }}>
        <P small muted>{p.marca} · {st?.nombre}</P>
        <H1>{prodName(p)}</H1>
        {p.descripcion ? <P muted>{p.descripcion}</P> : null}
      </View>
      {closed ? <Note kind="red" icon="clock">{st?.aviso_cerrada || L('La tienda está cerrada en este momento.', 'The store is closed right now.')}</Note> : null}
      <Card>
        <Pills
          label={L('Elige', 'Choose')}
          options={p.product_variants.map((x) => ({ v: x.id, label: `${x.label} · ${money(x.price)}${x.stock < 1 ? ' · ' + L('agotado', 'sold out') : ''}`, disabled: x.stock < 1 }))}
          value={vid}
          onChange={(x) => { setVid(x); setQty(1); setAdded(false); }}
        />
        {v && v.stock > 0 ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>{L('Cantidad', 'Quantity')}</Label>
            <Row gap={8}>
              {[['−', -1], ['+', 1]].map(([s, d]) => (
                <Pressable key={s as string} accessibilityRole="button" accessibilityLabel={d === 1 ? L('Más', 'More') : L('Menos', 'Less')} onPress={() => { setQty((q) => Math.max(1, Math.min(max, q + (d as number)))); setAdded(false); }}
                  style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.line2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink }}>{s}</Text>
                </Pressable>
              ))}
              <Text style={{ fontSize: 20, fontWeight: '900', minWidth: 30, textAlign: 'center', color: C.ink }}>{qty}</Text>
            </Row>
          </Row>
        ) : null}
        {v ? <P small muted>{v.stock > 0 ? L(`Quedan ${v.stock}`, `${v.stock} left`) : L('Se agotó esta opción', 'This option is sold out')}</P> : null}
        {p.compat ? <Note kind="blue">{L('Compatible con: ', 'Works with: ') + p.compat}</Note> : null}
      </Card>
      {v && v.stock > 0 && st && credCfg.on !== false && ((modOn(st, 'credit') && Number(v.price) >= Number(credCfg.minPrice || 0)) || (credCfg.layaway !== false && modOn(st, 'layaway'))) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plan', params: { variant: v.id } })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.gold, backgroundColor: C.goldSoft, opacity: pressed ? 0.85 : 1 })}>
          <IcoBox n="wallet" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '900', color: C.ink }}>{L('Ver planes de pago', 'See payment plans')}</Text>
            <P small muted>{L('Llévatelo en abonos semanales, quincenales o mensuales, o apártalo.', 'Take it home with weekly, biweekly or monthly payments, or use layaway.')}</P>
          </View>
        </Pressable>
      ) : null}
      {ask ? (
        <Note kind="gold" icon="cart">
          {L('Tu carrito tiene productos de otra tienda. Cada compra es de una sola tienda.', 'Your cart has products from another store. Each purchase is from one store.')}
        </Note>
      ) : null}
      {ask ? <Btn kind="ghost" title={L('Vaciar carrito y agregar este', 'Empty cart and add this one')} onPress={() => add(true)} /> : null}
    </Screen>
  );
}
