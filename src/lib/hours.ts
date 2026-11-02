/** Horario por día de cada sucursal: si está abierta ahora y a qué hora cierra o abre. */
import { Platform } from 'react-native';
import type { DayHours, Store } from './types';

export const DEFAULT_HOURS: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, on: true, a: d === 0 ? '10:00' : '09:00', c: d === 0 ? '16:00' : '20:00' }));
export const hoursOf = (st: Pick<Store, 'horas'>): DayHours[] => (st.horas && st.horas.length === 7 ? [...st.horas].sort((x, y) => x.d - y.d) : DEFAULT_HOURS);

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : NaN;
};
export const validTime = (t: string) => {
  const n = toMin(t);
  return Number.isFinite(n) && n >= 0 && n <= 24 * 60;
};
/** 9:00 am / 8:30 pm */
export function fmtTime(t: string, lang: 'es' | 'en') {
  const n = toMin(t);
  if (!Number.isFinite(n)) return t;
  const h = Math.floor(n / 60) % 24, m = n % 60;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`.replace('am', lang === 'es' ? 'am' : 'AM').replace('pm', lang === 'es' ? 'pm' : 'PM');
}

/** Día de la semana y minutos de ahora en la zona horaria de la tienda */
function nowIn(tz: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at);
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value || '');
    const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    return { d: wd < 0 ? at.getDay() : wd, min: h * 60 + m };
  } catch {
    return { d: at.getDay(), min: at.getHours() * 60 + at.getMinutes() };
  }
}

export interface OpenState { open: boolean; label: { es: string; en: string }; today: number }
export function openState(st: Store, at = new Date()): OpenState {
  const { d, min } = nowIn(st.tz || 'America/Chicago', at);
  const hs = hoursOf(st);
  if (st.abierta === false) return { open: false, today: d, label: { es: 'Cerrada por ahora', en: 'Closed for now' } };
  const t = hs[d];
  if (t?.on && min >= toMin(t.a) && min < toMin(t.c)) return { open: true, today: d, label: { es: `Abierta · cierra ${fmtTime(t.c, 'es')}`, en: `Open · closes ${fmtTime(t.c, 'en')}` } };
  if (t?.on && min < toMin(t.a)) return { open: false, today: d, label: { es: `Cerrada · abre hoy ${fmtTime(t.a, 'es')}`, en: `Closed · opens today ${fmtTime(t.a, 'en')}` } };
  for (let i = 1; i <= 7; i++) {
    const n = hs[(d + i) % 7];
    if (n?.on) {
      const dayEs = i === 1 ? 'mañana' : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][n.d];
      const dayEn = i === 1 ? 'tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n.d];
      return { open: false, today: d, label: { es: `Cerrada · abre ${dayEs} ${fmtTime(n.a, 'es')}`, en: `Closed · opens ${dayEn} ${fmtTime(n.a, 'en')}` } };
    }
  }
  return { open: false, today: d, label: { es: 'Cerrada', en: 'Closed' } };
}

export const DAY_NAMES = { es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };

/** Dirección pública de la ficha de la sucursal (la que abre el QR del cartel). */
export function storeLink(id: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return `https://semmarcomoya-jpg.github.io/Multiservicesweb/sucursal/${id}`;
  const m = /^(.*?)\/(admin|tienda)(\/|$)/.exec(window.location.pathname);
  return `${window.location.origin}${m ? m[1] : ''}/sucursal/${id}`;
}

