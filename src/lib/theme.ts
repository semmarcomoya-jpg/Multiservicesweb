// Paleta azul de dos tonos: azul marino/rey para lo principal y azul cielo para acentos
export const C = {
  page: '#EAF2FB',
  cream: '#F5F9FE',
  card: '#FFFFFF',
  ink: '#0B1F3A',
  muted: '#55688A',
  softInk: '#3B5276',
  line: '#D9E5F3',
  line2: '#BFD2EA',
  brown: '#1656A8',
  brownDark: '#0B2E5E',
  blue: '#2A8BDA',
  blueSoft: '#DDEEFC',
  blueInk: '#0D4A82',
  gold: '#62BDF6',
  goldSoft: '#E2F1FD',
  goldInk: '#0D4A82',
  sand: '#E0EBF8',
  red: '#8E2A1B',
  redSoft: '#F7DCD6',
  tint: '#EDF4FD',
  seg: '#D8E5F5',
  segInk: '#284369',
  icoBg: '#D8EAFB',
  /** Fondo del botón elegido en los selectores (texto blanco encima) */
  sel: '#0B1F3A',
  /** Fondo semitransparente sobre la portada */
  glass: 'rgba(255,255,255,0.92)',
  /** Texto azul fuerte sobre tarjetas */
  strong: '#0B2E5E',
};

// ---------- Modo noche
// Se elige en Perfil → Ajustes y se guarda en este equipo. Al cambiarlo la app se recarga
// para que todas las pantallas tomen los colores nuevos.
export type ThemePref = 'auto' | 'light' | 'dark';
const THEME_KEY = 'castillo.theme';
const DARK: Partial<typeof C> = {
  page: '#0E1726', cream: '#152238', card: '#18263D', ink: '#E8F0FB', muted: '#9DB0CC', softInk: '#C3D2E8',
  line: '#26385A', line2: '#33496F', brown: '#3D86DD', brownDark: '#0A1A33', blue: '#5AAAF0', blueSoft: '#1B3354',
  blueInk: '#A6CFFA', gold: '#62BDF6', goldSoft: '#173049', goldInk: '#A9D8FF', sand: '#1A2A44', red: '#F08A78',
  redSoft: '#3A1E1C', tint: '#1A2A44', seg: '#1F3150', segInk: '#C3D2E8', icoBg: '#1F3556',
  sel: '#3D86DD', glass: 'rgba(24,38,61,0.9)', strong: '#A6CFFA',
};
export function getThemePref(): ThemePref {
  try {
    if (typeof localStorage !== 'undefined') return (localStorage.getItem(THEME_KEY) as ThemePref) || 'auto';
  } catch {}
  return 'auto';
}
export function setThemePref(p: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, p);
    window.location.reload();
  } catch {}
}
export const isDark = (() => {
  const p = getThemePref();
  if (p === 'dark') return true;
  if (p === 'light') return false;
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
})();
if (isDark) {
  Object.assign(C, DARK);
  try {
    document.documentElement.style.backgroundColor = C.page;
    document.body.style.backgroundColor = C.page;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', C.brownDark);
  } catch {}
}

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  verificar: { bg: C.goldSoft, fg: C.goldInk },
  proceso: { bg: C.blueSoft, fg: C.blueInk },
  completado: isDark ? { bg: '#173A28', fg: '#8EE0AE' } : { bg: '#DDF1E4', fg: '#1E5B35' },
  rechazado: { bg: C.redSoft, fg: C.red },
};
