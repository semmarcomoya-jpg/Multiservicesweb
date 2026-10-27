import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

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
