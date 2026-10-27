import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { Category, Family, Mode, Product, Service, Settings, Store } from './types';

/** Carga simple con recarga manual. */
export function useQuery<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    const r = await fn();
    setData(r.data);
    setError(r.error);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { data, error, loading, reload: run };
}

export const useSettings = () => useQuery<Settings>(() => supabase.from('settings').select('*').eq('id', 1).single());
export const useStores = () => useQuery<Store[]>(() => supabase.from('stores').select('*').order('orden'));
export const useCategories = () => useQuery<Category[]>(() => supabase.from('service_categories').select('*').order('orden'));
export const useFamilies = () => useQuery<Family[]>(() => supabase.from('product_families').select('*').order('orden'));
/** Productos con sus variantes (el cliente solo recibe los prendidos; la tienda todos los suyos). */
export const useProducts = (storeId?: string | null) =>
  useQuery<Product[]>(() => {
    let q = supabase.from('products').select('*, product_variants(*)').order('orden');
    if (storeId) q = q.eq('store_id', storeId);
    return q;
  }, [storeId]);
export const useServices = () => useQuery<Service[]>(() => supabase.from('services').select('*').order('orden'));

// ---------- Reglas de negocio compartidas (el servidor las vuelve a validar)
export const modOn = (st: Store | null | undefined, k: keyof Store['mods']) => !!st && !(st.mods && st.mods[k] === false);

export const storesForService = (stores: Store[], sv: Service) =>
  stores.filter((st) => st.activo && modOn(st, 'svc') && !(st.svc_off || []).includes(sv.id));

/** Precio más bajo y existencias de un producto (solo variantes prendidas). */
export const prodFrom = (p: Product) => Math.min(...p.product_variants.filter((v) => v.activo).map((v) => Number(v.price)), Infinity);
export const prodStock = (p: Product) => p.product_variants.filter((v) => v.activo).reduce((a, v) => a + v.stock, 0);
export const prodName = (p: { marca: string; modelo: string }) => `${p.marca} ${p.modelo}`.trim();

/** Formas de entrega que el servicio permite y la tienda tiene encendidas. */
export function modesFor(st: Store | null | undefined, wanted: Mode[]): Mode[] {
  if (!st) return [];
  const d = st.delivery || ({} as Store['delivery']);
  return wanted.filter((m) => m === 'digital' || (m === 'store' && d.pickup !== false) || (m === 'curb' && d.curb !== false) || (m === 'home' && !!d.home));
}

export function homeFee(st: Store | null | undefined, subtotal: number): number {
  if (!st || !st.delivery?.home) return 0;
  const free = Number(st.delivery.freeOver) || 0;
  if (free > 0 && subtotal >= free) return 0;
  return Number(st.delivery.homeFee) || 0;
}

export const svcCatIcon = (cats: Category[], sv: Service) => sv.icon || cats.find((c) => c.id === sv.cat_id)?.icon || 'tool';

export const storeShort = (st: Store) => st.nombre.replace('Castillo · ', '');
/** Opciones de tienda para el cliente: las cerradas aparecen pero no se pueden elegir. */
export const storeOptions = (stores: Store[], closedLabel: string) =>
  stores.map((st) => ({ v: st.id, label: storeShort(st) + (st.abierta === false ? ' · ' + closedLabel : ''), icon: 'store', disabled: st.abierta === false }));
/** Tienda preferida: la favorita si está abierta, si no la primera abierta. */
export const pickOpen = (stores: Store[], fav?: string | null) =>
  (stores.find((x) => x.id === fav && x.abierta !== false) || stores.find((x) => x.abierta !== false) || stores[0])?.id ?? null;
