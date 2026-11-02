/** Países a los que se envía y de donde son los clientes. */
import type { Settings } from './types';

export interface Country { c: string; es: string; en: string; flag: string; cur: string; phone: number; acct: string; acctEn: string; bancos: string[]; redes: string[] }

export const COUNTRIES: Country[] = [
  { c: 'MX', es: 'México', en: 'Mexico', flag: '🇲🇽', cur: 'MXN', phone: 10, acct: 'CLABE (18 dígitos) o tarjeta (16)', acctEn: 'CLABE (18 digits) or card (16)', bancos: ['BBVA', 'Banorte', 'Santander', 'Banamex', 'Banco Azteca', 'Bancoppel', 'HSBC', 'Otro'], redes: ['Elektra', 'Coppel', 'Banco Azteca', 'Bodega Aurrera', 'Walmart', 'OXXO'] },
  { c: 'GT', es: 'Guatemala', en: 'Guatemala', flag: '🇬🇹', cur: 'GTQ', phone: 8, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Banrural', 'BI (Banco Industrial)', 'G&T Continental', 'Bantrab', 'BAM', 'Otro'], redes: ['Banrural', 'BI', 'Elektra', 'Bantrab'] },
  { c: 'SV', es: 'El Salvador', en: 'El Salvador', flag: '🇸🇻', cur: 'USD', phone: 8, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Banco Agrícola', 'Cuscatlán', 'Davivienda', 'Banco de América Central', 'Otro'], redes: ['Banco Agrícola', 'Davivienda', 'Súper Selectos'] },
  { c: 'HN', es: 'Honduras', en: 'Honduras', flag: '🇭🇳', cur: 'HNL', phone: 8, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Banco Atlántida', 'BAC Credomatic', 'Ficohsa', 'Banpaís', 'Otro'], redes: ['Banco Atlántida', 'Ficohsa', 'Elektra'] },
  { c: 'NI', es: 'Nicaragua', en: 'Nicaragua', flag: '🇳🇮', cur: 'NIO', phone: 8, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['BANPRO', 'BAC', 'Lafise', 'Otro'], redes: ['BANPRO', 'BAC'] },
  { c: 'CO', es: 'Colombia', en: 'Colombia', flag: '🇨🇴', cur: 'COP', phone: 10, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'Nequi', 'Otro'], redes: ['Efecty', 'Bancolombia'] },
  { c: 'DO', es: 'República Dominicana', en: 'Dominican Republic', flag: '🇩🇴', cur: 'DOP', phone: 10, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Banreservas', 'Popular', 'BHD', 'Otro'], redes: ['Banreservas', 'Caribe Express'] },
  { c: 'EC', es: 'Ecuador', en: 'Ecuador', flag: '🇪🇨', cur: 'USD', phone: 10, acct: 'Número de cuenta', acctEn: 'Account number', bancos: ['Pichincha', 'Guayaquil', 'Produbanco', 'Otro'], redes: ['Banco Pichincha', 'Western Union'] },
  { c: 'PE', es: 'Perú', en: 'Peru', flag: '🇵🇪', cur: 'PEN', phone: 9, acct: 'Número de cuenta o CCI', acctEn: 'Account number or CCI', bancos: ['BCP', 'Interbank', 'BBVA Perú', 'Scotiabank', 'Otro'], redes: ['BCP', 'Interbank'] },
  { c: 'US', es: 'Estados Unidos', en: 'United States', flag: '🇺🇸', cur: 'USD', phone: 10, acct: '', acctEn: '', bancos: [], redes: [] },
];
export const countryOf = (c?: string | null) => COUNTRIES.find((x) => x.c === (c || 'MX')) || COUNTRIES[0];

export interface PaisCfg { c: string; on: boolean; cur: string; rate: number; fee: number }
/** Tipo de cambio y comisión del país (México usa el de siempre). */
export function paisCfg(cfg: Settings | null | undefined, c?: string | null): PaisCfg {
  const code = c || 'MX';
  if (code === 'MX') return { c: 'MX', on: true, cur: 'MXN', rate: Number(cfg?.exchange_rate) || 0, fee: Number(cfg?.send_fee) || 0 };
  const p = (cfg?.paises || []).find((x) => x.c === code);
  return { c: code, on: !!p?.on, cur: p?.cur || countryOf(code).cur, rate: Number(p?.rate) || 0, fee: Number(p?.fee ?? cfg?.send_fee) || 0 };
}
/** Países activos para enviar */
export const sendCountries = (cfg: Settings | null | undefined) => COUNTRIES.filter((c) => c.c !== 'US' && paisCfg(cfg, c.c).on);

export const fmtCur = (v: unknown, cur = 'MXN') => {
  const n = Number(v) || 0;
  return (cur === 'USD' ? '$' : '') + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
};

/** Estados / departamentos por país (para el perfil y la tarjeta de días especiales) */
export const STATES: Record<string, string[]> = {
  MX: ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'],
  GT: ['Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'],
  SV: ['Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután'],
  HN: ['Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso', 'Francisco Morazán', 'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz', 'Lempira', 'Ocotepeque', 'Olancho', 'Santa Bárbara', 'Valle', 'Yoro'],
};
