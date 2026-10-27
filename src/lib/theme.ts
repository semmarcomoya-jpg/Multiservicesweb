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
};

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  verificar: { bg: C.goldSoft, fg: C.goldInk },
  proceso: { bg: C.blueSoft, fg: C.blueInk },
  completado: { bg: '#DDF1E4', fg: '#1E5B35' },
  rechazado: { bg: C.redSoft, fg: C.red },
};
