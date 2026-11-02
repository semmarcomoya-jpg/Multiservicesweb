/** Alerta de pedido nuevo: sonido (sintetizado, sin archivos) y vibración. Se elige por equipo en Mi tienda. */
import { Platform } from 'react-native';

export type AlertSound = 'caja' | 'campana' | 'timbre' | 'sin';
const KEY = 'castillo.alertSound';

export function getSound(): AlertSound {
  try {
    if (Platform.OS === 'web') return ((localStorage.getItem(KEY) as AlertSound) || 'caja');
  } catch {}
  return 'caja';
}
export function setSound(s: AlertSound) {
  try {
    if (Platform.OS === 'web') localStorage.setItem(KEY, s);
  } catch {}
}

let ctx: AudioContext | null = null;
export function playAlert(kind: AlertSound = getSound()) {
  if (Platform.OS !== 'web' || kind === 'sin') return;
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const notes: [number, number][] = kind === 'caja' ? [[1318, 0], [1760, 0.09], [2093, 0.18]] : kind === 'campana' ? [[880, 0], [1108, 0.25]] : [[660, 0], [660, 0.18], [660, 0.36]];
    notes.forEach(([f, t]) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = kind === 'timbre' ? 'square' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(now + t);
      o.stop(now + t + 0.4);
    });
  } catch {}
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}
