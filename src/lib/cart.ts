import { useSyncExternalStore } from 'react';

import type { OrderItem } from './types';

/** Carrito en memoria. Solo puede tener productos de una tienda. */
export interface Cart { storeId: string | null; items: OrderItem[] }

let cart: Cart = { storeId: null, items: [] };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const useCart = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => cart,
    () => cart,
  );

/** Agrega un producto. Si es de otra tienda, regresa false para preguntar antes de vaciar. */
export function addToCart(storeId: string, item: OrderItem, force = false): boolean {
  if (cart.storeId && cart.storeId !== storeId && cart.items.length && !force) return false;
  const base = cart.storeId === storeId ? cart.items : [];
  const i = base.findIndex((x) => x.variant_id === item.variant_id);
  const items = i >= 0 ? base.map((x, j) => (j === i ? { ...x, qty: x.qty + item.qty } : x)) : [...base, item];
  cart = { storeId, items };
  emit();
  return true;
}

export function setQty(variantId: string, qty: number) {
  const items = qty <= 0 ? cart.items.filter((x) => x.variant_id !== variantId) : cart.items.map((x) => (x.variant_id === variantId ? { ...x, qty } : x));
  cart = { storeId: items.length ? cart.storeId : null, items };
  emit();
}

export function clearCart() {
  cart = { storeId: null, items: [] };
  emit();
}

export const cartCount = (c: Cart) => c.items.reduce((a, x) => a + x.qty, 0);
export const cartTotal = (c: Cart) => c.items.reduce((a, x) => a + x.qty * Number(x.price), 0);
