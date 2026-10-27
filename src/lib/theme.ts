// Paleta naranja de Castillo Multiservices (misma que la maqueta)
export const C = {
  page: '#FBEEE2',
  cream: '#FFF7F0',
  card: '#FFFFFF',
  ink: '#2E1B10',
  muted: '#7A5F4E',
  softInk: '#5E4636',
  line: '#F1DCCB',
  line2: '#E6C9B3',
  brown: '#B84E17',
  brownDark: '#7A3412',
  blue: '#1F6F78',
  blueSoft: '#DDEFF0',
  blueInk: '#14525A',
  gold: '#F2A541',
  goldSoft: '#FDEBD3',
  goldInk: '#7A3B0E',
  sand: '#F8E2CF',
  red: '#8E2A1B',
  redSoft: '#F7DCD6',
  tint: '#FFF3E8',
  seg: '#F3D9C3',
  segInk: '#5E3A22',
  icoBg: '#FFE7CC',
};

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  verificar: { bg: C.goldSoft, fg: C.goldInk },
  proceso: { bg: C.blueSoft, fg: C.blueInk },
  completado: { bg: '#DDF1E4', fg: '#1E5B35' },
  rechazado: { bg: C.redSoft, fg: C.red },
};
