/** Programa de puntos por tienda (igual que la maqueta). */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { supabase } from './supabase';
import type { LedgerRow, Loyalty, Reward, Store } from './types';

export const DEFAULT_LOYALTY: Loyalty = { on: false, perTx: 10, per100: 5, bday: 0, postPts: 10, rewards: [] };

export function loyaltyOf(st: Store | null | undefined) {
  const ly = st?.loyalty;
  if (!ly || !ly.on) return null;
  const perTx = Number(ly.perTx) || 0;
  const per100 = Number(ly.per100) || 0;
  const rewards = (ly.rewards || []).map((r) => ({ ...r, pts: Number(r.pts) || 0, value: Number(r.value) || 0 })).sort((a, b) => a.pts - b.pts);
  return { perTx, per100, bday: Number(ly.bday) || 0, postPts: Number(ly.postPts) || 0, rewards, ptsFor: (m: number) => Math.round(perTx + Math.floor((Number(m) || 0) / 100) * per100) };
}

/** Descuento que da un premio en un pedido (o 0 si no aplica). */
export const rewardDiscount = (r: Reward, total: number, fee: number) => (r.type === 'fee' ? Math.min(fee, total) : Math.min(Number(r.value) || 0, total));

/** Mis movimientos de puntos y mi saldo por tienda. */
export function useMyPoints(userId: string | null | undefined) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const load = useCallback(async () => {
    if (!userId) return;
    await supabase.rpc('claim_birthday'); // si es tu mes, te da tus puntos de cumpleaños (una vez al año)
    const { data } = await supabase.from('points_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500);
    setRows((data as LedgerRow[]) ?? []);
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const balance = (storeId: string) => Math.max(0, (rows || []).filter((r) => r.store_id === storeId).reduce((a, r) => a + r.pts, 0));
  return { rows, balance, reload: load };
}
