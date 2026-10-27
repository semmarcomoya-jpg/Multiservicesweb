/** Avisos dentro de la app (campanita). Se actualizan solos cuando llega uno nuevo. */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';
import type { Notif } from './types';

let list: Notif[] = [];
let uid: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export async function loadNotifs() {
  if (!uid) return;
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  list = (data as Notif[]) ?? [];
  emit();
}

let channel: ReturnType<typeof supabase.channel> | null = null;
function start(userId: string) {
  if (uid === userId) return;
  uid = userId;
  void loadNotifs();
  if (channel) void supabase.removeChannel(channel);
  channel = supabase
    .channel('notifs-' + userId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void loadNotifs())
    .subscribe();
}

export function useNotifs(userId: string | null | undefined) {
  useEffect(() => {
    if (userId) start(userId);
  }, [userId]);
  const items = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => list,
    () => list,
  );
  return { items, unread: items.filter((n) => !n.read_at).length };
}

export async function markRead(id: string) {
  list = list.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n));
  emit();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllRead() {
  const now = new Date().toISOString();
  list = list.map((n) => (n.read_at ? n : { ...n, read_at: now }));
  emit();
  await supabase.rpc('mark_notifications_read');
}
