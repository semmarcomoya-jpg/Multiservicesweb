/** Avisos con la app cerrada (Web Push). La llave pública no es secreta. */
import { Platform } from 'react-native';

import { supabase } from './supabase';

export const VAPID_PUBLIC = 'BBGEbbgT8ri2Y8sNd_I036S-dSRc8aDEssjpHka6xbLAKx2l8779TXbyNBI4LqGRraq_zVlyr5pmeRIHbjF-roY';

export const pushSupported = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** En iPhone solo funciona con la app instalada en la pantalla de inicio (iOS 16.4+). */
export const isIosBrowser = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  const base = (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href.replace(/manifest\.json$/, '') || '/';
  return navigator.serviceWorker.register(base + 'sw.js');
}

export async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) || null;
}

/** Pide permiso, se suscribe y guarda la suscripción de este equipo. */
export async function enablePush(userId: string) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso denegado');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subs').upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
  if (error) throw error;
}

export async function disablePush() {
  const sub = await currentSub();
  if (!sub) return;
  await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
