/** Destacados de Inicio: lo que elige el administrador y, en modo automático, lo que más se vende. */
import { useQuery, useServices, useProducts, useSettings } from './data';
import { supabase } from './supabase';
import type { Featured, Product, Service, TopSeller } from './types';

export type FeaturedItem = { kind: 'product'; ref_id: string; product: Product; hot: boolean } | { kind: 'service'; ref_id: string; service: Service; hot: boolean };

export const useFeaturedRows = () => useQuery<Featured[]>(() => supabase.from('featured').select('*').order('orden'));
export const useTopSellers = (days = 30, limit = 8) => useQuery<TopSeller[]>(() => supabase.rpc('top_sellers', { p_days: days, p_limit: limit }), [days, limit]);

/** Junta lo elegido + (en automático) lo más vendido, sin repetir y solo lo que sigue disponible. */
export function buildFeatured(
  rows: Featured[],
  top: TopSeller[],
  modo: 'auto' | 'manual',
  products: Product[],
  services: Service[],
  max = 8,
): FeaturedItem[] {
  top = Array.isArray(top) ? top : [];
  const hot = new Set(top.slice(0, 3).map((t) => t.kind + t.ref_id));
  const list = [...rows.map((r) => ({ kind: r.kind, ref_id: r.ref_id })), ...(modo === 'auto' ? top.map((t) => ({ kind: t.kind, ref_id: t.ref_id })) : [])];
  const seen = new Set<string>();
  const out: FeaturedItem[] = [];
  for (const it of list) {
    const k = it.kind + it.ref_id;
    if (seen.has(k)) continue;
    seen.add(k);
    if (it.kind === 'product') {
      const p = products.find((x) => x.id === it.ref_id && x.activo && x.product_variants.some((v) => v.activo));
      if (p) out.push({ kind: 'product', ref_id: p.id, product: p, hot: hot.has(k) });
    } else {
      const sv = services.find((x) => x.id === it.ref_id && x.activo);
      if (sv) out.push({ kind: 'service', ref_id: sv.id, service: sv, hot: hot.has(k) });
    }
    if (out.length >= max) break;
  }
  return out;
}

export function useDestacados() {
  const { data: cfg } = useSettings();
  const { data: rows } = useFeaturedRows();
  const { data: top } = useTopSellers();
  const { data: products } = useProducts(null);
  const { data: services } = useServices();
  if (!cfg || !rows || !products || !services) return null;
  return buildFeatured(rows, top || [], cfg.destacados_modo || 'auto', products, services);
}
