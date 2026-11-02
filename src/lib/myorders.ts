import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Order } from './types';

/** Pedidos del cliente; se recargan cada vez que la pantalla vuelve a verse. */
export function useMyOrders(limit = 50) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(limit);
    setOrders((data as Order[]) ?? []);
  }, [session, limit]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return { orders, reload: load };
}

/** Cuántos pedidos del cliente siguen en curso (para el contador de la barra de abajo). */
export function useActiveOrderCount() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const load = () =>
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['verificar', 'proceso'])
        .then(({ count }) => alive && setN(count || 0));
    load();
    const ch = supabase.channel('mis-pedidos-' + uid).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${uid}` }, load).subscribe();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [uid]);
  return n;
}
