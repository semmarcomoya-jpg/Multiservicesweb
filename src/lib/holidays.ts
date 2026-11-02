/** Días especiales: de Estados Unidos, del país del cliente y de su estado. Se calculan solos cada año. */
import type { Settings } from './types';

export interface Special { date: Date; es: string; en: string; where: string; kind: 'us' | 'pais' | 'estado' | 'tienda'; idea?: 'send' | 'shop' }

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
/** n-ésimo día de la semana del mes (wd: 0 = domingo). n = -1 → el último. */
function nth(y: number, m: number, wd: number, n: number) {
  if (n > 0) {
    const first = D(y, m, 1);
    return D(y, m, 1 + ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
  }
  const last = new Date(y, m, 0, 12);
  return D(y, m, last.getDate() - ((last.getDay() - wd + 7) % 7));
}
/** Domingo de Pascua (algoritmo de Meeus) */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, month, day);
}
const plus = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n, 12);

type Row = [Date, string, string, ('send' | 'shop')?];

function us(y: number): Row[] {
  return [
    [D(y, 1, 1), 'Año Nuevo', "New Year's Day"],
    [nth(y, 1, 1, 3), 'Día de Martin Luther King Jr.', 'Martin Luther King Jr. Day'],
    [D(y, 2, 14), 'Día del Amor y la Amistad', "Valentine's Day", 'shop'],
    [nth(y, 2, 1, 3), 'Día de los Presidentes', "Presidents' Day"],
    [nth(y, 5, 0, 2), 'Día de las Madres (EE. UU.)', "Mother's Day (U.S.)", 'shop'],
    [nth(y, 5, 1, -1), 'Memorial Day', 'Memorial Day'],
    [nth(y, 6, 0, 3), 'Día del Padre', "Father's Day", 'shop'],
    [D(y, 6, 19), 'Juneteenth', 'Juneteenth'],
    [D(y, 7, 4), 'Día de la Independencia (EE. UU.)', 'Independence Day'],
    [nth(y, 9, 1, 1), 'Día del Trabajo (EE. UU.)', 'Labor Day'],
    [D(y, 10, 31), 'Halloween', 'Halloween'],
    [D(y, 11, 11), 'Día de los Veteranos', "Veterans Day"],
    [nth(y, 11, 4, 4), 'Día de Acción de Gracias', 'Thanksgiving', 'shop'],
    [plus(nth(y, 11, 4, 4), 1), 'Black Friday', 'Black Friday', 'shop'],
    [D(y, 12, 25), 'Navidad', 'Christmas', 'send'],
  ];
}

const semanaSanta = (y: number): Row[] => [[plus(easter(y), -3), 'Jueves Santo', 'Holy Thursday'], [plus(easter(y), -2), 'Viernes Santo', 'Good Friday']];

const PAIS: Record<string, (y: number) => Row[]> = {
  MX: (y) => [
    [D(y, 1, 6), 'Día de Reyes', "Three Kings' Day", 'send'],
    [nth(y, 2, 1, 1), 'Día de la Constitución', 'Constitution Day'],
    [nth(y, 3, 1, 3), 'Natalicio de Benito Juárez', "Benito Juárez's Birthday"],
    ...semanaSanta(y),
    [D(y, 4, 30), 'Día del Niño', "Children's Day", 'send'],
    [D(y, 5, 10), 'Día de las Madres en México', "Mother's Day in Mexico", 'send'],
    [D(y, 9, 16), 'Día de la Independencia de México', 'Mexican Independence Day', 'send'],
    [D(y, 11, 2), 'Día de Muertos', 'Day of the Dead', 'send'],
    [nth(y, 11, 1, 3), 'Día de la Revolución', 'Revolution Day'],
    [D(y, 12, 12), 'Día de la Virgen de Guadalupe', 'Our Lady of Guadalupe', 'send'],
    [D(y, 12, 25), 'Navidad', 'Christmas', 'send'],
  ],
  GT: (y) => [...semanaSanta(y), [D(y, 5, 10), 'Día de la Madre en Guatemala', "Mother's Day in Guatemala", 'send'], [D(y, 6, 30), 'Día del Ejército', 'Army Day'], [D(y, 9, 15), 'Día de la Independencia de Guatemala', 'Guatemalan Independence Day', 'send'], [D(y, 10, 20), 'Día de la Revolución', 'Revolution Day'], [D(y, 11, 1), 'Día de Todos los Santos', "All Saints' Day", 'send'], [D(y, 12, 24), 'Nochebuena', 'Christmas Eve', 'send']],
  SV: (y) => [...semanaSanta(y), [D(y, 5, 10), 'Día de la Madre en El Salvador', "Mother's Day in El Salvador", 'send'], [D(y, 8, 6), 'Fiestas del Divino Salvador del Mundo', 'Feast of the Divine Savior'], [D(y, 9, 15), 'Día de la Independencia de El Salvador', 'Salvadoran Independence Day', 'send'], [D(y, 11, 2), 'Día de los Difuntos', "All Souls' Day", 'send'], [D(y, 12, 24), 'Nochebuena', 'Christmas Eve', 'send']],
  HN: (y) => [...semanaSanta(y), [nth(y, 5, 0, 2), 'Día de la Madre en Honduras', "Mother's Day in Honduras", 'send'], [D(y, 9, 15), 'Día de la Independencia de Honduras', 'Honduran Independence Day', 'send'], [D(y, 10, 3), 'Día de Francisco Morazán', 'Francisco Morazán Day'], [D(y, 12, 24), 'Nochebuena', 'Christmas Eve', 'send']],
  NI: (y) => [...semanaSanta(y), [D(y, 5, 30), 'Día de la Madre en Nicaragua', "Mother's Day in Nicaragua", 'send'], [D(y, 9, 15), 'Día de la Independencia de Nicaragua', 'Nicaraguan Independence Day', 'send'], [D(y, 12, 8), 'La Purísima', 'Feast of the Immaculate Conception', 'send']],
  CO: (y) => [...semanaSanta(y), [nth(y, 5, 0, 2), 'Día de la Madre en Colombia', "Mother's Day in Colombia", 'send'], [D(y, 7, 20), 'Día de la Independencia de Colombia', 'Colombian Independence Day', 'send'], [D(y, 12, 7), 'Noche de Velitas', 'Little Candles Night']],
  DO: (y) => [...semanaSanta(y), [D(y, 2, 27), 'Día de la Independencia Dominicana', 'Dominican Independence Day', 'send'], [nth(y, 5, 0, -1), 'Día de las Madres en R. D.', "Mother's Day (D.R.)", 'send']],
  EC: (y) => [...semanaSanta(y), [nth(y, 5, 0, 2), 'Día de la Madre en Ecuador', "Mother's Day in Ecuador", 'send'], [D(y, 8, 10), 'Primer Grito de Independencia', 'Independence Day'], [D(y, 11, 2), 'Día de los Difuntos', "All Souls' Day", 'send']],
  PE: (y) => [...semanaSanta(y), [nth(y, 5, 0, 2), 'Día de la Madre en Perú', "Mother's Day in Peru", 'send'], [D(y, 7, 28), 'Fiestas Patrias', 'Independence Day', 'send']],
};

/** Algunas fiestas por estado (se pueden agregar más desde Admin → Textos y ayuda) */
const ESTADO: Record<string, (y: number) => Row[]> = {
  'MX:Puebla': (y) => [[D(y, 5, 5), 'Batalla de Puebla', 'Battle of Puebla']],
  'MX:Oaxaca': (y) => [[nth(y, 7, 1, -1), 'Guelaguetza', 'Guelaguetza']],
  'MX:Jalisco': (y) => [[D(y, 10, 1), 'Fiestas de Octubre', 'October Festival'], [D(y, 10, 12), 'Romería de Zapopan', 'Zapopan Pilgrimage']],
  'MX:Nuevo León': (y) => [[D(y, 9, 20), 'Aniversario de Monterrey', 'Monterrey Anniversary']],
  'MX:Michoacán': (y) => [[D(y, 11, 1), 'Noche de Muertos en Pátzcuaro', 'Night of the Dead in Pátzcuaro', 'send']],
  'MX:Yucatán': (y) => [[D(y, 10, 31), 'Hanal Pixán', 'Hanal Pixán', 'send']],
  'MX:Guanajuato': (y) => [[nth(y, 10, 3, 2), 'Festival Internacional Cervantino', 'Cervantino Festival']],
  'MX:Veracruz': (y) => [[plus(easter(y), -51), 'Carnaval de Veracruz', 'Veracruz Carnival']],
  'MX:Chiapas': (y) => [[D(y, 1, 15), 'Fiesta Grande de Chiapa de Corzo', 'Great Festival of Chiapa de Corzo']],
  'MX:Zacatecas': (y) => [[nth(y, 8, 5, -1), 'Morismas de Bracho', 'Morismas of Bracho']],
  'MX:Guerrero': (y) => [[D(y, 10, 27), 'Aniversario de Guerrero', 'Guerrero Anniversary']],
  'GT:Quetzaltenango': (y) => [[D(y, 9, 15), 'Feria de Independencia de Xela', 'Xela Independence Fair']],
  'GT:Guatemala': (y) => [[D(y, 8, 15), 'Feria de la Virgen de la Asunción', 'Feast of the Assumption']],
  'SV:San Miguel': (y) => [[nth(y, 11, 6, -1), 'Carnaval de San Miguel', 'San Miguel Carnival']],
  'HN:Atlántida': (y) => [[nth(y, 5, 6, 3), 'Carnaval de La Ceiba', 'La Ceiba Carnival']],
  'HN:Cortés': (y) => [[D(y, 6, 29), 'Feria Juniana', 'June Fair']],
};

/** Próximos días especiales del cliente (hoy incluido), del más cercano al más lejano */
export function upcomingSpecials(pais: string | null | undefined, estado: string | null | undefined, cfg: Settings | null | undefined, days = 60, from = new Date()): Special[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0);
  const end = new Date(today.getTime() + days * 86400000);
  const out: Special[] = [];
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    us(y).forEach(([date, es, en, idea]) => out.push({ date, es, en, where: 'EE. UU.', kind: 'us', idea }));
    if (pais && pais !== 'US' && PAIS[pais]) PAIS[pais](y).forEach(([date, es, en, idea]) => out.push({ date, es, en, where: pais, kind: 'pais', idea }));
    if (pais && estado && ESTADO[`${pais}:${estado}`]) ESTADO[`${pais}:${estado}`](y).forEach(([date, es, en, idea]) => out.push({ date, es, en, where: estado, kind: 'estado', idea }));
    (cfg?.dias || []).forEach((x) => {
      if (x.pais && x.pais !== '*' && x.pais !== pais) return;
      if (x.estado && x.estado !== estado) return;
      out.push({ date: D(y, Number(x.m), Number(x.d)), es: x.es, en: x.en || x.es, where: x.estado || x.pais || '', kind: 'tienda' });
    });
  }
  // Sin repetidos (p. ej. Navidad de EE. UU. y de México): gana el del país del cliente
  const seen = new Map<string, Special>();
  out.filter((s) => s.date >= today && s.date < end).sort((a, b) => a.date.getTime() - b.date.getTime()).forEach((s) => {
    const k = s.date.toDateString() + '|' + s.es.replace(/ \(.*\)| en .*| de .*$/, '');
    if (!seen.has(k) || s.kind !== 'us') seen.set(k, s);
  });
  return [...seen.values()];
}

export const daysUntil = (d: Date, from = new Date()) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000);
